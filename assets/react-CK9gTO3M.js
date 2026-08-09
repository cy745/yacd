import{o as e,t}from"./react-B4U2ED-D.js";import{g as n,h as r}from"./app-BOpObSoK.js";var i=`modulepreload`,a=function(e,t){return new URL(e,t).href},o={},s=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),s=document.querySelector(`meta[property=csp-nonce]`),c=s?.nonce||s?.getAttribute(`nonce`);function l(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function u(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,new URL(`../../../src/node/plugins/importAnalysisBuild.ts`,import.meta.url)).href}r=l(t.map(t=>{if(t=a(t,n),t=u(t),t in o)return;o[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let s=document.createElement(`link`);if(s.rel=r?`stylesheet`:i,r||(s.as=`script`),s.crossOrigin=``,s.href=t,c&&s.setAttribute(`nonce`,c),document.head.appendChild(s),r)return new Promise((e,n)=>{s.addEventListener(`load`,e),s.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}))}function s(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&s(e.reason);return e().catch(s)})},c=e(t(),1),l=(0,c.createContext)(void 0);function u(e){let t=(0,c.useContext)(l);return e?.store||t||r()}var d=e=>typeof e?.then==`function`,f=e=>{e.status||(e.status=`pending`,e.then(t=>{e.status=`fulfilled`,e.value=t},t=>{e.status=`rejected`,e.reason=t}))},p=c.default.use||(e=>{if(e.status===`pending`)throw e;if(e.status===`fulfilled`)return e.value;throw e.status===`rejected`?e.reason:(f(e),e)}),m=new WeakMap,h=(e,t,r)=>{let i=n(e),a=i[26],o=m.get(t);return o||(o=new Promise((n,s)=>{let c=t,l=e=>t=>{c===e&&n(t)},u=e=>t=>{c===e&&s(t)},f=()=>{try{let t=r();d(t)?(m.set(t,o),c=t,t.then(l(t),u(t)),a(i,e,t,f)):n(t)}catch(e){s(e)}};t.then(l(t),u(t)),a(i,e,t,f)}),m.set(t,o)),o};function g(e,t){let{delay:n,unstable_promiseStatus:r=!c.default.use}=t||{},i=u(t),[[a,o,s],l]=(0,c.useReducer)(t=>{let n=i.get(e);return Object.is(t[0],n)&&t[1]===i&&t[2]===e?t:[n,i,e]},void 0,()=>[i.get(e),i,e]),m=a;if((o!==i||s!==e)&&(l(),m=i.get(e)),(0,c.useEffect)(()=>{let t=i.sub(e,()=>{if(r)try{let t=i.get(e);d(t)&&f(h(i,t,()=>i.get(e)))}catch{}if(typeof n==`number`){console.warn(`[DEPRECATED] delay option is deprecated and will be removed in v3.

Migration guide:

Create a custom hook like the following.

function useAtomValueWithDelay<Value>(
  atom: Atom<Value>,
  options: { delay: number },
): Value {
  const { delay } = options
  const store = useStore(options)
  const [value, setValue] = useState(() => store.get(atom))
  useEffect(() => {
    const unsub = store.sub(atom, () => {
      setTimeout(() => setValue(store.get(atom)), delay)
    })
    return unsub
  }, [store, atom, delay])
  return value
}
`),setTimeout(l,n);return}l()});return l(),t},[i,e,n,r]),(0,c.useDebugValue)(m),d(m)){let t=h(i,m,()=>i.get(e));return r&&f(t),p(t)}return m}function _(e,t){let n=u(t);return(0,c.useCallback)((...t)=>n.set(e,...t),[n,e])}function v(e,t){return[g(e,t),_(e,t)]}export{s as n,v as t};