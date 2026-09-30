window.overlayAPI.onData(d=>{for(const id of ['status','hands','move','counts'])document.getElementById(id).textContent=d[id]||'';});
