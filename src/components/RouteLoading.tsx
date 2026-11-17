import '../styles/loading.css';

export function RouteLoading({website=false}:{website?:boolean}){
  return <div className={'route-loading'+(website?' is-website':'')} role="status" aria-label={website?'Loading product page':'Loading workspace'} aria-busy="true">
    <div className="route-loading-header" aria-hidden="true"><span className="route-loading-brand"><span className="route-loading-mark"/>Diagram Studio</span><span className="route-loading-actions"><i/><i/><i/></span></div>
    <div className="route-loading-layout" aria-hidden="true"><div className="route-loading-rail"><i/><i/><i/><i/></div><div className="route-loading-main"><div className="route-loading-heading"><i/><i/><i/></div><div className="route-loading-canvas"><span/><span/><span/></div></div><div className="route-loading-inspector"><i/><i/><i/><i/><i/></div></div>
  </div>;
}
