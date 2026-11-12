import type { Diagram } from '../lib/model';
import { Icon } from './Icon';
export function Playback({document, scenario, step, readOnly, onScenario, onStep}: {
  document: Diagram; scenario: number; step: number; readOnly: boolean;
  onScenario: (index: number) => void; onStep: (index: number) => void;
}) {
  const current = document.scenarios[scenario];
  const byId = new Map(document.nodes.map(n => [n.id,n]));
  const active = byId.get(current.steps[step]);
  return <section className="playback-panel"><div className="section-heading"><h2>Scenario Playback</h2><span className="section-tag">{document.scenarios.length} paths</span></div><p className="hint">Follow a path through your system, one step at a time.</p>
    <label htmlFor="scenario">Active Scenario</label><select id="scenario" value={scenario} onChange={e => onScenario(Number(e.target.value))}>{document.scenarios.map((s,i) => <option value={i} key={i}>{s.name}{!readOnly && s.review?.length ? ' — Needs Review' : ''}</option>)}</select>
    {current.description && <p className="reader-context">{current.description}</p>}
    <p id="step" aria-live="polite">{active ? `${step+1} / ${current.steps.length} · ${active.label}` : 'This scenario has no steps yet.'}</p>
    {active?.notes && <div className="reader-context"><strong>Step Notes</strong><p>{active.notes}</p></div>}
    <progress id="progress" aria-label="Scenario Playback Progress" aria-valuetext={current.steps.length ? `Step ${step+1} of ${current.steps.length}` : 'No Steps'} max={Math.max(1,current.steps.length)} value={current.steps.length ? step+1 : 0}/>
    <ol id="timeline" aria-label="Playback Steps">{current.steps.map((id,i) => <li key={i}><button onClick={() => onStep(i)} aria-current={i === step ? 'step' : undefined} aria-label={`Step ${i+1}: ${byId.get(id)!.label}`}>{byId.get(id)!.label}</button></li>)}</ol>
    <div className="actions playback-actions"><button id="prev" disabled={step === 0} onClick={() => onStep(step-1)}><Icon name="left" size={15}/>Previous</button><button id="next" className="primary" disabled={step+1 >= current.steps.length} onClick={() => onStep(step+1)}>Next Step<Icon name="right" size={15}/></button></div>
    <div className="playback-footer"><button id="restart" className="quiet-button" disabled={step === 0} onClick={() => onStep(0)}><Icon name="restart" size={14}/>Restart</button><span><kbd>←</kbd><kbd>→</kbd> Navigate</span></div>
  </section>;
}
