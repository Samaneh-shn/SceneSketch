export default function PromptReviewModal({ show, onClose, children }) {
  if (!show) return null;
  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
