import { useEffect, useState } from 'react';
import type { Diagram } from '../lib/model';
import { Icon } from './Icon';
import { arrangeNodes, flagScenarios } from '../lib/model';

function Field({id, label, value, onCommit, multiline = false, max = 48, disabled = false, placeholder}: {
  id: string; label: string; value: string; onCommit: (value: string) => void; multiline?: boolean; max?: number; disabled?: boolean; placeholder?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => { if (text.trim() !== value) onCommit(text.trim()); };
  return <><label htmlFor={id}>{label}</label>{multiline ? <textarea id={id} rows={3} value={text} onChange={e => setText(e.target.value)} onBlur={commit} maxLength={max} disabled={disabled} placeholder={placeholder}/> :
    <input id={id} value={text} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} maxLength={max} disabled={disabled} placeholder={placeholder}/>}</>;
}
interface Props {
  document: Diagram; scenario: number; selected?: string; onSelect: (id?: string) => void;
  onChange: (edit: (draft: Diagram) => void) => void; onScenario: (index: number) => void;
  confirm: (title: string, message: string, action: () => void) => void;
}
export function Editor({document, scenario, selected, onSelect, onChange, onScenario, confirm}: Props) {
  const [route, setRoute] = useState(0);
  const [branchName, setBranchName] = useState('');
  const [newName, setNewName] = useState('');
  const current = document.scenarios[scenario];
  const node = document.nodes.find(n => n.id === selected);
  const index = Math.min(route, current.steps.length-1);
  useEffect(() => setRoute(0), [scenario]);
  const addScenario = (branch: boolean) => {
    const name = (branch ? branchName : newName).trim();
    if (!name || (branch && index < 0)) return;
    const next = document.scenarios.length;
    onChange(d => d.scenarios.push({ name, steps: branch ? current.steps.slice(0,index+1) : [], ...(branch && current.review?.length ? { review: [...current.review] } : {}) }));
    onScenario(next); setBranchName(''); setNewName('');
  };
  const move = (direction: number) => {
    const target = index+direction;
    if (index < 0 || target < 0 || target >= current.steps.length) return;
    onChange(d => { const steps = d.scenarios[scenario].steps; [steps[index],steps[target]] = [steps[target],steps[index]]; });
    setRoute(target);
  };
  return <section id="editor"><div className="section-heading"><span className="section-icon" aria-hidden="true">⌘</span><h2>Diagram Editor</h2></div>
    <p className="hint">Drag to arrange. Reuse nodes across every scenario. Text changes save when you leave a field.</p>
    <Field id="project-title" label="Project Title" value={document.title || ''} max={80} placeholder="e.g. Order Processing System" onCommit={value => onChange(d => { d.title = value; })}/>
    <button id="auto-arrange" disabled={!document.nodes.length} onClick={() => onChange(d => Object.assign(d, arrangeNodes(d,scenario,globalThis.document.querySelector('.board')?.clientWidth || 900)))}><Icon name="arrange" size={15}/>Arrange Nodes</button>
    <Field id="label" label="Selected Node Label" value={node?.label || ''} disabled={!node} placeholder="Give this step a clear name" onCommit={value => { if (!value || !node) return; onChange(d => { flagScenarios(d,node.id,`Renamed “${node.label}” to “${value}”.`); d.nodes.find(n => n.id === node.id)!.label = value; }); }}/>
    <details className="editor-details"><summary>Node Notes</summary><Field key={selected} id="node-notes" label="Explain This Node" value={node?.notes || ''} disabled={!node} multiline max={2000} placeholder="What happens here? Notes appear during playback." onCommit={value => { if (node) onChange(d => { flagScenarios(d,node.id,`Updated notes for “${node.label}”.`); d.nodes.find(n => n.id === node.id)!.notes = value; }); }}/></details>
    <div className="actions editor-actions"><button id="add" disabled={document.nodes.length >= 250} onClick={() => {
      const id = crypto.randomUUID(); onChange(d => d.nodes.push({id,label:'New Node',x:50,y:70})); onSelect(id);
    }}><Icon name="plus" size={15}/>Add Node</button><button id="remove" className="danger" disabled={!node} onClick={() => { if (!node) return; onChange(d => { flagScenarios(d,node.id,`Deleted “${node.label}”; its steps were removed.`); d.nodes = d.nodes.filter(n => n.id !== node.id); for (const s of d.scenarios) s.steps = s.steps.filter(id => id !== node.id); }); onSelect(document.nodes.find(n => n.id !== node.id)?.id); }}><Icon name="trash" size={14}/>Delete Node</button></div>
    <div className="editor-divider"/>
    <Field key={'name'+scenario} id="scenario-name" label="Current Scenario Name" value={current.name} onCommit={value => { if (value) onChange(d => { d.scenarios[scenario].name = value; }); }}/>
    <div className="actions"><button id="duplicate-scenario" disabled={document.scenarios.length >= 100} onClick={() => {
      const copy = structuredClone(current), base = current.name.slice(0,35)+' (Copy)'; copy.name = base;
      let suffix = 2; while (document.scenarios.some(s => s.name === copy.name)) copy.name = base+' '+suffix++;
      onChange(d => d.scenarios.push(copy)); onScenario(document.scenarios.length);
    }}><Icon name="copy" size={14}/>Duplicate</button><button id="delete-scenario" className="danger" disabled={document.scenarios.length <= 1} onClick={() => confirm('Delete Scenario',`Delete “${current.name}”? The diagram nodes will be kept. You can undo this edit.`,() => { onChange(d => { d.scenarios.splice(scenario,1); }); onScenario(Math.max(0,scenario-1)); })}>Delete Scenario</button></div>
    <details className="editor-details"><summary>Scenario Description</summary><Field key={'description'+scenario} id="scenario-description" label="Explain This Path" value={current.description || ''} multiline max={2000} onCommit={value => onChange(d => { d.scenarios[scenario].description = value; })}/></details>
    <label htmlFor="route">Scenario Steps</label><select id="route" size={4} value={index < 0 ? '' : index} onChange={e => setRoute(Number(e.target.value))}>{current.steps.map((id,i) => <option value={i} key={i}>{i+1}. {document.nodes.find(n => n.id === id)!.label}</option>)}</select>
    <div className="actions"><button id="append" disabled={!node || current.steps.length >= 500} onClick={() => { if (selected) onChange(d => d.scenarios[scenario].steps.push(selected)); }}><Icon name="plus" size={14}/>Append Node</button><button id="drop" disabled={index < 0} onClick={() => onChange(d => { d.scenarios[scenario].steps.splice(index,1); })}>Remove Step</button></div>
    <div className="actions route-actions"><button id="move-up" disabled={index <= 0} onClick={() => move(-1)}>↑ Move Up</button><button id="move-down" disabled={index < 0 || index >= current.steps.length-1} onClick={() => move(1)}>↓ Move Down</button></div>
    <div className="actions route-actions"><button id="insert-step" disabled={!node || index < 0 || current.steps.length >= 500} onClick={() => { if (selected) onChange(d => { d.scenarios[scenario].steps.splice(index,0,selected); }); }}>Insert Before Step</button><button id="replace-step" disabled={!node || index < 0} onClick={() => { if (selected) onChange(d => { d.scenarios[scenario].steps[index] = selected; }); }}>Replace Step</button></div>
    <details className="editor-details"><summary>Create an Alternate Path</summary><p className="hint">Select a step above. Keep the path up to that point and build an alternate ending.</p><label htmlFor="branch-name">Alternate Scenario Name</label><input id="branch-name" maxLength={48} value={branchName} onChange={e => setBranchName(e.target.value)}/><button id="branch" disabled={!branchName.trim() || index < 0 || document.scenarios.length >= 100} onClick={() => addScenario(true)}>Branch From Selected Step</button></details>
    <details className="editor-details"><summary>Add a New Scenario</summary><label htmlFor="name">Scenario Name</label><input id="name" maxLength={48} value={newName} onChange={e => setNewName(e.target.value)}/><button id="create" disabled={!newName.trim() || document.scenarios.length >= 100} onClick={() => addScenario(false)}><Icon name="plus" size={14}/>Add Scenario</button></details>
    <div className="review-panel"><div className="section-heading"><span className="section-icon" aria-hidden="true">✓</span><h2>Scenario Review</h2></div><p className="hint">Node changes flag affected scenarios. Play each path to verify your edits.</p><ul id="reviews">{document.scenarios.some(s => s.review?.length) ? document.scenarios.map((s,i) => s.review?.length ? <li key={i}><button onClick={() => onScenario(i)}>{s.name}</button><p>{s.review.join(' ')}</p></li> : null) : <li>All Scenarios Reviewed.</li>}</ul><button id="reviewed" disabled={!current.review?.length} onClick={() => onChange(d => { delete d.scenarios[scenario].review; })}>Mark Current Scenario Reviewed</button></div>
  </section>;
}
