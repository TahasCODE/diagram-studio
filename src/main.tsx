import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import {lazy,Suspense} from 'react';
import {RouteLoading} from './components/RouteLoading';
import '../style.css';

class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Diagram Studio could not render.',error,info); }
  render() { return this.state.failed ? <div className="page-state"><h1>Something Went Wrong</h1><p>Your browser-saved project is still available. Reload to reopen it.</p><button onClick={() => location.reload()}>Reload Workspace</button></div> : this.props.children; }
}
const website=/^\/welcome\/?$/.test(location.pathname);
if(website)document.documentElement.dataset.surface='website';
const Page=website?lazy(()=>import('./components/LandingPage')):lazy(()=>import('./App'));
createRoot(document.getElementById('root')!).render(<ErrorBoundary><Suspense fallback={<RouteLoading website={website}/>}><Page/></Suspense></ErrorBoundary>);
