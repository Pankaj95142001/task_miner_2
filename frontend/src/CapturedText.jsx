export function CapturedText({ step }) {
  if (step.action !== 'input') return null;
  if (step.text_capture === 'protected') return <span>Typed text: private field excluded.</span>;
  if (step.source === 'desktop' && (step.sensitive || !step.text_capture || step.text_capture === 'unavailable')) return <span>Typed text unavailable. Add it to the instruction above before verifying.</span>;
  if (step.sensitive) return <span>Typed text: private field excluded.</span>;
  return <div className="captured-text"><strong>Typed text</strong><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{step.value || '(Field cleared)'}</div>{step.text_capture === 'truncated' && <span>First 2,000 characters only. Complete the instruction above before verifying.</span>}</div>;
}
