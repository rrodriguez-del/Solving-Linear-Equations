/* Small REST client: no external scripts required for offline gameplay. */
window.ALACloud = (() => {
  const config = window.ALA_CONFIG || {};
  const configured = !!(config.url && config.publicKey);
  function validate() {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)) throw Error('Invalid project URL');
    let role = '';
    try { role = JSON.parse(atob(config.publicKey.split('.')[1])).role; } catch (_) {}
    if (!(config.publicKey.startsWith('sb_publishable_') || role === 'anon')) throw Error('Use only a public publishable or anon key');
  }
  async function request(path, body, token, method='POST') {
    validate();
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),12000);
    try {
      const res = await fetch(config.url+path, {method, signal:controller.signal,
        headers:{apikey:config.publicKey, 'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw Error(data?.msg || data?.message || 'Database request failed ('+res.status+')');
      return data;
    } finally { clearTimeout(timer); }
  }
  async function auth(kind, credentials) {
    const key='ala-auth-'+kind;
    let session;
    try { session=JSON.parse(sessionStorage.getItem(key)); } catch (_) {}
    if (credentials) session = await request('/auth/v1/token?grant_type=password',credentials);
    else if(session && session.expires_at*1000<Date.now()+60000)
      session=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
    else if(!session && kind==='student') session=await request('/auth/v1/signup',{data:{}});
    if(!session?.access_token) throw Error('Teacher sign-in required');
    session.expires_at=session.expires_at || Math.floor(Date.now()/1000)+session.expires_in;
    sessionStorage.setItem(key,JSON.stringify(session));
    return session;
  }
  return {configured,request,auth,logout:()=>sessionStorage.removeItem('ala-auth-teacher')};
})();
