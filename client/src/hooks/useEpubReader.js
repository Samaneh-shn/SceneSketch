import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';

/** ---------- tiny IndexedDB for book binaries ---------- */
const DB_NAME = 'SceneSketchBooks';
const STORE   = 'books';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(id, buffer) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(buffer, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbDel(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** ---------- Library index (localStorage) ---------- */
const LIB_KEY = 'ss_library_v1';
const readJSON = (k, d=[]) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function readLib() { return readJSON(LIB_KEY, []); }
function writeLib(list) { writeJSON(LIB_KEY, list); }
function upsertLibItem(item) {
  const lib = readLib();
  const i = lib.findIndex(x => x.id === item.id);
  if (i >= 0) lib[i] = { ...lib[i], ...item };
  else lib.unshift(item);
  writeLib(lib);
  return lib;
}
function removeLibItem(id) {
  const lib = readLib().filter(x => x.id !== id);
  writeLib(lib);
  return lib;
}

/** ---------- Per-book bookmarks storage ---------- */
const BM_PREFIX = 'ss_bookmarks_v1_';
const readBookmarks = (bookId) => readJSON(BM_PREFIX + (bookId || 'unknown'), []);
const writeBookmarks = (bookId, list) => writeJSON(BM_PREFIX + (bookId || 'unknown'), list);
const deleteBookmarksBucket = (bookId) => localStorage.removeItem(BM_PREFIX + (bookId || 'unknown'));

/** stable id from name+size+mtime */
function makeBookId(file) {
  const s = `${file.name}|${file.size}|${file.lastModified||0}`;
  let h = 2166136261 >>> 0;
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
  return `bk_${(h>>>0).toString(16)}`;
}

const CHARS_PER_LOC = 180;

export default function useEpubReader({ theme='light', onTextSelected } = {}) {
  const [fileName, setFileName]   = useState('');
  const [book, setBook]           = useState(null);
  const [rendition, setRendition] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(0);
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState('');

  const [bookmarks, setBookmarks]     = useState([]);
  const [library, setLibrary]         = useState(readLib());

  // internals
  const isFixedRef     = useRef(false);
  const linearAbsRef   = useRef([]);
  const probeReadyRef  = useRef(false);
  const pageCFIsRef    = useRef([]);
  const locationsReady = useRef(false);
  const resizeTimerRef = useRef(null);

  // persistence
  const bookIdRef      = useRef(null);
  const lastCFIRef     = useRef(null);

  const iframeDoc = () => document.querySelector('#reader iframe')?.contentDocument || null;
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  /* ---------- theme styling in iframe ---------- */
  const applyTheme = (doc) => {
    if (!doc) return;
    let style = doc.querySelector('style.scenesketch-theme');
    if (!style) {
      style = doc.createElement('style');
      style.className = 'scenesketch-theme';
      doc.head.appendChild(style);
    }
    style.textContent = `
      html,body{margin:0!important;padding:0!important;}
      ${theme==='dark'
        ? 'body{background:#0f172a!important;color:#e2e8f0!important;}'
        : 'body{background:#fff!important;color:#1e293b!important;}'}
      img,svg,image,video,canvas{max-width:100%!important;height:auto!important;}
      table{display:block!important;max-width:100%!important;overflow-x:auto!important;}
      pre,code{white-space:pre-wrap!important;word-break:break-word!important;}
    `;
  };

  /* ---------- numbering helpers ---------- */
  const compareCFI = (a,b) => {
    try {
      if (book?.cfi?.compare) return book.cfi.compare(a,b);
      if (ePub?.CFI?.compare) return ePub.CFI.compare(a,b);
    } catch {}
    return String(a).localeCompare(String(b));
  };
  const findPageIndexByCFI = (cfi) => {
    const arr = pageCFIsRef.current;
    if (!arr.length) return 0;
    let lo=0, hi=arr.length-1, ans=0;
    while (lo<=hi) {
      const mid=(lo+hi)>>1;
      const cmp=compareCFI(arr[mid], cfi);
      if (cmp<=0){ ans=mid; lo=mid+1; } else { hi=mid-1; }
    }
    return ans;
  };
  const hrefToAbsIndex = (hrefRaw) => {
    const href = (hrefRaw||'').split('#')[0];
    const items = book?.spine?.items || [];
    let abs = items.findIndex(it => it.href && (it.href===href || it.href.endsWith(href)));
    if (abs<0) {
      const tail = href.split('/').pop();
      abs = items.findIndex(it => it.href && it.href.endsWith(tail));
    }
    return abs>=0 ? abs : 0;
  };

  const updateFromLocation = (location) => {
    if (!book||!location) return;

    if (!isFixedRef.current && probeReadyRef.current && pageCFIsRef.current.length>0) {
      const cfi = location?.start?.cfi || location?.end?.cfi;
      const idx = findPageIndexByCFI(cfi);
      const page=idx+1, tot=pageCFIsRef.current.length;
      setCurrentPage(page); setTotalPages(tot);
      setProgress(Math.min(100,(page/tot)*100));
      lastCFIRef.current = cfi;
      return;
    }

    if (!isFixedRef.current && locationsReady.current && (book.locations?.total||0)>0) {
      const cfi = location?.start?.cfi;
      let cur = 1;
      try {
        const idx = book.locations.locationFromCfi(cfi);
        if (typeof idx==='number' && idx>=0) cur = idx+1;
        else {
          const pct = book.locations.percentageFromCfi(cfi);
          if (pct && pct>0) cur = Math.max(1, Math.round(pct*book.locations.total));
        }
      } catch {}
      const tot = Math.max(1, book.locations.total);
      setCurrentPage(cur); setTotalPages(tot);
      setProgress(Math.min(100,(cur/tot)*100));
      lastCFIRef.current = cfi;
      return;
    }

    // fixed
    if (isFixedRef.current) {
      const abs = hrefToAbsIndex(location?.start?.href);
      const pos = Math.max(0, linearAbsRef.current.indexOf(abs));
      const cur = pos+1, tot=Math.max(1, linearAbsRef.current.length || (book.spine?.items?.length||1));
      setCurrentPage(cur); setTotalPages(tot);
      setProgress(Math.min(100,(cur/tot)*100));
      lastCFIRef.current = location?.start?.cfi || null;
    }
  };

  async function buildLocations() {
    locationsReady.current = false;
    try {
      await book.locations.generate(CHARS_PER_LOC);
      locationsReady.current = (book.locations?.total||0) > 0;
    } catch {
      locationsReady.current = false;
    }
  }

  async function runProbe() {
    probeReadyRef.current = false;
    pageCFIsRef.current = [];

    const host = document.getElementById('reader');
    const w = Math.max(1, host?.clientWidth || 800);
    const h = Math.max(1, host?.clientHeight || 500);

    const probeEl = document.createElement('div');
    Object.assign(probeEl.style, { position:'fixed', left:'-100000px', top:'0', width:`${w}px`, height:`${h}px`, overflow:'hidden', visibility:'hidden', pointerEvents:'none', zIndex:'-1' });
    document.body.appendChild(probeEl);

    let probe;
    const push = (cfi) => {
      if (!cfi) return;
      const arr=pageCFIsRef.current;
      if (arr.length===0 || compareCFI(arr[arr.length-1], cfi)!==0) arr.push(cfi);
    };

    try {
      probe = book.renderTo(probeEl, { width:w, height:h, manager:'default', flow:'paginated', spread:'auto', allowScripts:false });
      for (const abs of linearAbsRef.current) {
        const sec = book.spine.get(abs);
        if (!sec) continue;
        await probe.display(sec);
        await sleep(30);
        const first = probe.currentLocation?.();
        push(first?.start?.cfi);

        let last = first?.start?.cfi || '';
        let guard = 0;
        while (guard++ < 600) {
          const before = probe.currentLocation?.();
          const p = before?.start?.displayed?.page || 1;
          const t = before?.start?.displayed?.total || 1;
          if (p>=t) break;
          await probe.next();
          await sleep(10);
          const after = probe.currentLocation?.();
          const cfi = after?.start?.cfi || '';
          if (!cfi || compareCFI(cfi,last)===0) break;
          push(cfi);
          last = cfi;
        }
      }

      if (pageCFIsRef.current.length>0) {
        probeReadyRef.current = true;
        setTotalPages(pageCFIsRef.current.length);
        const loc = rendition?.currentLocation?.();
        if (loc) updateFromLocation(loc);
      }
    } catch {
      probeReadyRef.current = false;
    } finally {
      try { await probe?.destroy?.(); } catch {}
      probeEl.remove();
    }
  }

  /** ------- position persistence in library index ------- */
  function savePosition() {
    const id = bookIdRef.current;
    const cfi = lastCFIRef.current;
    if (!id || !cfi) return;
    upsertLibItem({ id, lastCfi:cfi, lastVisited: Date.now(), name: fileName });
    setLibrary(readLib());
  }
  function getSavedPosition(id) {
    const item = readLib().find(x => x.id === id);
    return item?.lastCfi || null;
  }

  /** ------- open helpers ------- */
  async function openFromArrayBuffer(buffer, idHint, nameHint) {
    const b = new ePub();
    await b.open(buffer);
    setBook(b);
    setFileName(nameHint || 'Untitled');
    bookIdRef.current = idHint || null;

    // load persisted bookmarks for this book id
    setBookmarks(readBookmarks(idHint));
  }

  /** public: user selected a file */
  const loadFromFile = (file) => {
    if (!file) return;
    const id = makeBookId(file);
    bookIdRef.current = id;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const buf = evt.target.result;
      try {
        await idbPut(id, buf);
        upsertLibItem({
          id,
          name: file.name,
          size: file.size,
          type: file.type || 'application/epub+zip',
          addedAt: Date.now()
        });
        setLibrary(readLib());
        await openFromArrayBuffer(buf, id, file.name);
      } catch (err) {
        setError(`Failed to open EPUB: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /** public: open from Library by id */
  const openFromLibrary = async (id) => {
    const buf = await idbGet(id);
    if (!buf) { setError('This book data is missing.'); return; }
    const item = readLib().find(x=>x.id===id);
    await openFromArrayBuffer(buf, id, item?.name || 'Untitled');
  };

  /** public: remove from Library (and its bookmark bucket) */
  const removeFromLibrary = async (id) => {
    await idbDel(id);
    deleteBookmarksBucket(id);
    setLibrary(removeLibItem(id));
    // If currently reading this id, we leave reader as-is.
  };

  /* ---------------- build rendition on book change ---------------- */
  useEffect(() => {
    if (!book) return;

    probeReadyRef.current = false;
    pageCFIsRef.current = [];
    locationsReady.current = false;
    linearAbsRef.current = [];

    const host = document.getElementById('reader');
    if (host) host.innerHTML = '';

    let r;
    (async () => {
      await book.ready;

      // linear spine
      const items = book.spine?.items || [];
      linearAbsRef.current = items
        .map((it,i)=>((it.linear||'yes')!=='no' ? i : null))
        .filter(i=>i!==null);

      // fixed-layout?
      const meta = book.package?.metadata || {};
      const fixedByMeta =
        meta.layout === 'pre-paginated' ||
        meta['rendition:layout'] === 'pre-paginated' ||
        meta.fixed_layout === true;
      const fixedBySpine = (items||[]).some(it =>
        String(it.properties||'').includes('pre-paginated') ||
        String(it.properties||'').includes('rendition:layout-pre-paginated'));
      isFixedRef.current = fixedByMeta || fixedBySpine;

      r = book.renderTo('reader', {
        width: '100%',
        height: 500,
        manager: 'default',
        flow: isFixedRef.current ? 'scrolled-doc' : 'paginated',
        spread: isFixedRef.current ? 'none' : 'auto',
        allowScripts: true,
      });
      setRendition(r);

      if (!isFixedRef.current) await buildLocations();

      r.on('displayed', (view) => {
        applyTheme(view?.document);
        const loc = r.currentLocation?.();
        if (loc) updateFromLocation(loc);
      });

      r.on('relocated', (location) => {
        updateFromLocation(location);
        savePosition();
      });

      r.on('resized', () => {
        if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = setTimeout(async () => {
          applyTheme(iframeDoc());
          if (!isFixedRef.current) {
            await buildLocations();
            await runProbe();
          } else {
            const loc = r.currentLocation?.();
            if (loc) updateFromLocation(loc);
          }
        }, 250);
      });

      r.on('selected', (cfiRange) => {
        if (!onTextSelected) return;
        book.getRange(cfiRange).then((range)=> {
          const s = range?.toString().trim();
          if (s) onTextSelected(s);
        }).catch(()=>{});
      });

      // initial display: resume last position if we have it
      const resume = bookIdRef.current ? getSavedPosition(bookIdRef.current) : null;
      if (resume) await r.display(resume);
      else await r.display();

      document.getElementById('reader')?.classList.add('fade-in');
      applyTheme(iframeDoc());

      if (!isFixedRef.current) runProbe();
      else {
        setTotalPages(Math.max(1, linearAbsRef.current.length || items.length || 1));
        const loc = r.currentLocation?.();
        if (loc) updateFromLocation(loc);
      }
    })();

    return () => {
      try { r?.destroy?.(); } catch {}
      setRendition(null);
      if (resizeTimerRef.current) { clearTimeout(resizeTimerRef.current); resizeTimerRef.current=null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  /* theme apply */
  useEffect(() => { applyTheme(iframeDoc()); }, [theme]);

  /* navigation API */
  const next = async () => {
    if (!rendition) return;
    try { await rendition.next(); } catch {}
    const loc = rendition.currentLocation?.(); if (loc) updateFromLocation(loc);
  };
  const prev = async () => {
    if (!rendition) return;
    try { await rendition.prev(); } catch {}
    const loc = rendition.currentLocation?.(); if (loc) updateFromLocation(loc);
  };

  const goToPage = (pageNumber) => {
    if (!rendition || !book) return;

    if (!isFixedRef.current && probeReadyRef.current && pageCFIsRef.current.length>0) {
      const tot = pageCFIsRef.current.length;
      const target = Math.max(1, Math.min(pageNumber, tot));
      const cfi = pageCFIsRef.current[target-1];
      if (cfi) rendition.display(cfi).then(()=> {
        const loc = rendition.currentLocation?.(); if (loc) updateFromLocation(loc);
      }).catch(e=>setError(e.message));
      return;
    }

    if (!isFixedRef.current && locationsReady.current && (book.locations?.total||0)>0) {
      const total = Math.max(1, book.locations.total);
      const target = Math.max(1, Math.min(pageNumber, total));
      const pct = (target-1)/total;
      const cfi = book.locations.cfiFromPercentage(pct);
      if (cfi) rendition.display(cfi).then(()=> {
        const loc = rendition.currentLocation?.(); if (loc) updateFromLocation(loc);
      }).catch(e=>setError(e.message));
      return;
    }

    // fixed fallback
    const arr = linearAbsRef.current;
    const targetPos = Math.max(0, Math.min(pageNumber-1, arr.length-1));
    const abs = arr[targetPos] ?? targetPos;
    const sec = book.spine.get(abs);
    if (sec) rendition.display(sec).then(()=> {
      const loc = rendition.currentLocation?.(); if (loc) updateFromLocation(loc);
    }).catch(e=>setError(e.message));
  };

  const seekPercent = (pct) => {
    if (!book || !rendition) return;
    pct = Math.max(0, Math.min(1, pct));

    if (!isFixedRef.current && probeReadyRef.current && pageCFIsRef.current.length>0) {
      const tot = pageCFIsRef.current.length;
      const target = Math.max(1, Math.round(pct*tot));
      goToPage(target);
      return;
    }
    if (!isFixedRef.current && locationsReady.current && (book.locations?.total||0)>0) {
      const total = Math.max(1, book.locations.total);
      const target = Math.max(1, Math.round(pct*total));
      goToPage(target);
      return;
    }

    const arr = linearAbsRef.current;
    const targetPos = Math.max(0, Math.min(Math.round(pct*(arr.length-1)), arr.length-1));
    const abs = arr[targetPos] ?? targetPos;
    const sec = book.spine.get(abs);
    if (sec) rendition.display(sec).then(()=> {
      const loc = rendition.currentLocation?.(); if (loc) updateFromLocation(loc);
    }).catch(e=>setError(e.message));
  };

  /* --------------------- Bookmark helpers + API --------------------- */

  // Walk forward from the start-of-page CFI to find the first paragraph-ish block
  const extractLeadParagraphFromCfi = async (cfi) => {
    try {
      const range = await book.getRange(cfi);
      let node = range?.startContainer || null;

      let cur = (node && node.nodeType === Node.ELEMENT_NODE)
        ? node
        : node?.parentElement || null;

      const isHeading = (el) => {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        const t = el.tagName.toLowerCase();
        return ['h1','h2','h3','h4','h5','h6','header'].includes(t);
      };
      const isBlockCandidate = (el) => {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        const t = el.tagName.toLowerCase();
        return ['p','div','section','article','li','blockquote'].includes(t);
      };
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

      const maxSteps = 800;
      let steps = 0;

      const nextInDocOrder = (n) => {
        if (!n) return null;
        if (n.firstChild) return n.firstChild;
        while (n && !n.nextSibling) n = n.parentNode;
        return n ? n.nextSibling : null;
      };

      while (cur && steps++ < maxSteps) {
        if (cur.nodeType === Node.ELEMENT_NODE) {
          if (!isHeading(cur) && isBlockCandidate(cur)) {
            const text = clean(cur.textContent || '');
            if (text.length > 40) {
              return text.length > 280 ? text.slice(0, 280).replace(/\s+\S*$/, '') : text;
            }
          }
        } else if (cur.nodeType === Node.TEXT_NODE) {
          const text = clean(cur.textContent || '');
          if (text.length > 40) {
            return text.length > 280 ? text.slice(0, 280).replace(/\s+\S*$/, '') : text;
          }
        }
        cur = nextInDocOrder(cur);
      }
    } catch {}
    return '';
  };

  const addBookmark = async () => {
    if (!rendition) return setError('No rendition');
    const loc = rendition.currentLocation?.();
    const startCfi = loc?.start?.cfi;
    if (!startCfi) return setError('No valid location');

    let pageNum = currentPage || 1;
    if (!isFixedRef.current && probeReadyRef.current && pageCFIsRef.current.length > 0) {
      const idx = findPageIndexByCFI(startCfi);
      pageNum = idx + 1;
    } else if (!isFixedRef.current && locationsReady.current && (book.locations?.total || 0) > 0) {
      try {
        const idx = book.locations.locationFromCfi(startCfi);
        pageNum = (typeof idx === 'number' && idx >= 0) ? idx + 1 : (currentPage || 1);
      } catch { pageNum = currentPage || 1; }
    } else {
      const abs = hrefToAbsIndex(loc?.start?.href);
      const pos = Math.max(0, linearAbsRef.current.indexOf(abs));
      pageNum = pos + 1;
    }

    let label = await extractLeadParagraphFromCfi(startCfi);
    if (!label) {
      try {
        const r = await book.getRange(startCfi);
        label = (r?.toString().trim() || '').slice(0, 150);
      } catch {}
    }

    const nextList = [
      ...bookmarks,
      {
        cfi: startCfi,
        pageRange: String(pageNum),
        text: label || 'No text',
        bookTitle: fileName || 'Untitled',
        createdAt: new Date().toISOString(),
      }
    ].filter((b, i, arr) => arr.findIndex(x => x.cfi === b.cfi) === i);

    setBookmarks(nextList);
    writeBookmarks(bookIdRef.current, nextList);
  };

  const deleteBookmark = (cfi) => {
    const nextList = bookmarks.filter(b=>b.cfi!==cfi);
    setBookmarks(nextList);
    writeBookmarks(bookIdRef.current, nextList);
  };

  const exportBookmarks = () => {
    if (!bookmarks.length) return;
    const data = bookmarks.map((b,i)=>
      `Bookmark ${i+1}:\nBook: ${b.bookTitle||'Untitled'}\nPage: ${b.pageRange}\nText: ${b.text||'No text'}\n\n`
    ).join('');
    const blob = new Blob([data], { type:'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bookmarks.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const goToBookmark = (cfi) =>
    rendition?.display(cfi).then(()=>{ const l=rendition.currentLocation?.(); if (l) updateFromLocation(l); });

  // save on unload as an extra safety
  useEffect(() => {
    const h = () => savePosition();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** public API */
  return {
    fileName,
    error,
    currentPage,
    totalPagesDisplay: totalPages,
    progress,

    loadFromFile,
    openFromLibrary,
    removeFromLibrary,
    library,
    refreshLibrary: () => setLibrary(readLib()),

    next, prev, goToPage, seekPercent,

    bookmarks, addBookmark, deleteBookmark, exportBookmarks, goToBookmark,
  };
}
// working