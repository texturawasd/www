const DATA_URL = 'data.json';

let restaurants = [];
let demoAccounts = [
  {id:'u1', name:'Usuario - Visitante'},
  {id:'u2', name:'Usuario - Juan'},
  {id:'u3', name:'Usuario - Ana'}
];
let notificationsHistory = []; // store past notifications shown to user
let ignoredOffers = {}; // { restaurantId: Set(itemName) } (kept for backwards compatibility)
let ignoredRestaurants = new Set();
let reservedHistory = []; // store reservation records {ts, restaurantName, itemName, price}
let currentUser = null;
let currentBusiness = null;

function $(sel){return document.querySelector(sel)}

async function load(){
  const res = await fetch(DATA_URL);
  restaurants = await res.json();
  renderAccounts();
  renderRestaurants();
  simulateRealtime();
  // ensure business dashboard hidden on load
  const maybeBizDash = document.getElementById('bizDashboard'); if(maybeBizDash) maybeBizDash.classList.add('hidden');
  // initial UI: show login screen and hide app content until login
  document.getElementById('appContent').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');

  // wire login controls
  document.getElementById('generateDemo').onclick = ()=>{
    document.getElementById('loginEmail').value = 'demo@savebite.test';
    document.getElementById('loginPassword').value = generatePassword(8);
  };
  document.getElementById('loginBtn').onclick = ()=>{ login(); };

  // wire business button & modal
  const bizBtn = document.getElementById('businessBtn');
  const bizScreen = document.getElementById('businessScreen');
  bizBtn.onclick = ()=>{ document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('appContent').classList.remove('hidden'); bizScreen.classList.remove('hidden'); };
  document.getElementById('bizBack').onclick = ()=>{ bizScreen.classList.add('hidden'); document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('appContent').classList.add('hidden'); };
  document.getElementById('bizRegister').onclick = ()=>{
    const email = (document.getElementById('bizEmail').value||'').trim();
    const pass = (document.getElementById('bizPassword').value||'').trim();
    const name = (document.getElementById('bizName').value||'').trim();
    const addr = (document.getElementById('bizAddress').value||'').trim();
    const phone = (document.getElementById('bizPhone').value||'').trim();
    const cat = (document.getElementById('bizCategory').value||'').trim();
    if(!email || pass.length<8 || !name || !addr || !phone || !cat){ alert('Completa todos los campos con información válida (contraseña mínimo 8 caracteres).'); return; }
    // Business login/register: create or find restaurant and open business dashboard
    toast(`Bienvenido, ${name}`);
    // try to find existing restaurant by phone
    let found = restaurants.find(r=>r.phone && r.phone === phone);
    if(!found){
      const newId = 'biz-' + Date.now();
      found = {
        id: newId,
        name: name,
        address: addr,
        distance: (Math.floor(100 + Math.random()*900)/10) + ' km',
        timeLeftMin: 30,
        phone: phone,
        items: []
      };
      restaurants.unshift(found);
    }
    // show dashboard for this business
    showBizDashboard(found);
  };

  // Agregar demo: autocompletar formulario y crear un restaurante demo en memoria
  document.getElementById('bizDemo').onclick = ()=>{
    document.getElementById('bizEmail').value = 'demo-restaurant@savebite.test';
    document.getElementById('bizPassword').value = generatePassword(10);
    document.getElementById('bizName').value = 'Demo Restaurante El Rincón';
    document.getElementById('bizAddress').value = 'Calle Demo 123';
    document.getElementById('bizPhone').value = '+598 99 000 111';
    document.getElementById('bizCategory').value = 'Cocina rápida';

    const newId = 'rest-' + Date.now();
    const newR = {
      id: newId,
      name: document.getElementById('bizName').value,
      address: document.getElementById('bizAddress').value,
      distance: (Math.floor(100 + Math.random()*900)/10) + ' km',
      timeLeftMin: 15 + Math.floor(Math.random()*11),
      phone: document.getElementById('bizPhone').value,
      items: [
        { name: 'Caja sorpresa', qty: 5, originalPrice: 650, offerPrice: Math.round(650 * 0.45) },
        { name: 'Porción deli', qty: 4, originalPrice: 420, offerPrice: Math.round(420 * 0.5) }
      ]
    };
    // add to the beginning so appears first
    restaurants.unshift(newR);
    renderRestaurants();
    toast('Restaurante demo agregado: ' + newR.name);
  };

  // wire profile/menu buttons (profile info set after login)
  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  profileBtn.onclick = ()=>{
    // ensure profile info is fresh when opening the menu
    if(currentUser){
      document.getElementById('profileName').textContent = currentUser.fullName || '';
      document.getElementById('profilePhone').textContent = currentUser.phone ? `Tel: ${currentUser.phone}` : '';
      document.getElementById('profileId').textContent = `ID: ${currentUser.id}`;
    }
    profileMenu.classList.toggle('hidden');
  };
  const menuBtn = document.getElementById('menuBtn');
  const menuDropdown = document.getElementById('menuDropdown');
  menuBtn.onclick = ()=>{ menuDropdown.classList.toggle('hidden'); };
  // menu actions
  document.getElementById('menuNotif').onclick = ()=>{ document.getElementById('notifList').innerHTML = notificationsHistory.length? notificationsHistory.map(n=>`<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)">${n}</div>`).join('') : '<div style="padding:8px;color:var(--muted)">No hay notificaciones guardadas.</div>'; document.getElementById('notifModal').classList.remove('hidden'); menuDropdown.classList.add('hidden'); };
  document.getElementById('closeNotif').onclick = ()=>{ document.getElementById('notifModal').classList.add('hidden') };
  document.getElementById('menuHistory').onclick = ()=>{ openPurchaseModal(); menuDropdown.classList.add('hidden'); };
  document.getElementById('menuLogout').onclick = ()=>{ logout(); menuDropdown.classList.add('hidden'); };
  document.getElementById('closePurchase').onclick = ()=>{ document.getElementById('purchaseModal').classList.add('hidden') };
}

function showBizDashboard(restaurant){
  currentBusiness = restaurant;
  // hide login/app content and show only the business dashboard
  document.getElementById('businessScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContent').classList.add('hidden');
  document.getElementById('bizDashboard').classList.remove('hidden');
  // populate info and offers
  document.getElementById('bizInfo').innerHTML = `<div style="font-weight:700">${restaurant.name}</div><div style="font-size:13px;color:var(--muted)">${restaurant.address} · ${restaurant.distance} · ${restaurant.phone}</div>`;
  renderBizOffers();
  // wire dashboard buttons
  document.getElementById('bizAddOffer').onclick = ()=>{
    const name = prompt('Nombre de la oferta (ej: Caja sorpresa)'); if(!name) return;
    const qty = parseInt(prompt('Cantidad disponible (número)'),10) || 1;
    const orig = parseInt(prompt('Precio original (UYU, número)'),10) || 500;
    const offer = parseInt(prompt('Precio oferta (UYU, número)'),10) || Math.round(orig*0.5);
    currentBusiness.items.push({ name, qty, originalPrice: orig, offerPrice: offer });
    toast('Oferta añadida: '+name);
    renderBizOffers(); renderRestaurants();
  };
  document.getElementById('bizClosePanel').onclick = ()=>{
    // close dashboard and return to login screen
    currentBusiness = null;
    document.getElementById('bizDashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    const mainLayout = document.querySelector('main.layout'); if(mainLayout) mainLayout.classList.remove('hidden');
    // ensure appContent remains hidden (business logged out returns to login)
    document.getElementById('appContent').classList.add('hidden');
  };
}

function renderBizOffers(){
  const out = [];
  if(!currentBusiness) { document.getElementById('bizOffers').innerHTML = '<div style="color:var(--muted)">No hay negocio activo.</div>'; return; }
  currentBusiness.items.forEach((it,idx)=>{
    out.push(`<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)"><div style="font-weight:700">${it.name} <small style="color:var(--muted);font-weight:400">x${it.qty}</small></div><div style="font-size:13px;color:var(--muted)">${formatCurrency(it.offerPrice)} <span style="margin-left:8px;color:var(--muted)">orig ${formatCurrency(it.originalPrice)}</span></div></div>`);
  });
  document.getElementById('bizOffers').innerHTML = out.join('') || '<div style="color:var(--muted)">No hay ofertas aún.</div>';
}

function renderAccounts(){
  // demoAccounts exist for reference; no select UI in this build (profile shows current user)
}

function formatCurrency(val){
  try{
    return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(val);
  }catch(e){
    return 'UY$'+val;
  }
}

function renderRestaurants(){
  const container = $('#restaurants'); container.innerHTML='';
  // hide business dashboard for non-business views
  const bizDash = document.getElementById('bizDashboard'); if(bizDash && !currentBusiness) bizDash.classList.add('hidden');
  // show only spontaneous offers with <=30 minutes remaining
  let any=false;
  restaurants.forEach(r=>{
    if(!r.timeLeftMin || r.timeLeftMin>30) return;
    if(ignoredRestaurants.has(r.id)) return;
    const availableItems = r.items.filter(it=>it.qty>0);
    if(availableItems.length===0) return;
    any=true;

    const card = document.createElement('div'); card.className='card';
    const meta = document.createElement('div'); meta.className='meta';
    const h = document.createElement('h3'); h.textContent = r.name;
    const sub = document.createElement('div'); sub.className='muted'; sub.textContent = r.address + ' · ' + r.distance;
    const items = document.createElement('ul'); items.className='item-list';
    availableItems.forEach((it, idx)=>{
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.innerHTML = `${it.name} <small style="color:var(--muted);font-weight:400">x${it.qty}</small>`;
      const right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center';
      const priceSpan = document.createElement('span'); priceSpan.className='price'; priceSpan.textContent = formatCurrency(it.offerPrice);
      const discount = Math.round((1 - (it.offerPrice / it.originalPrice)) * 100);
      const disc = document.createElement('small'); disc.style.color='var(--muted)'; disc.style.fontSize='12px'; disc.style.marginLeft='8px'; disc.textContent = `(${discount}% off)`;
      const actions = document.createElement('div'); actions.className='item-actions';
      actions.appendChild(priceSpan); actions.appendChild(disc);
      right.appendChild(actions);
      li.appendChild(left); li.appendChild(right);
      items.appendChild(li);
    });
    meta.appendChild(h); meta.appendChild(sub); meta.appendChild(items);

    const aside = document.createElement('div');
    aside.className = 'aside';
    const badge = document.createElement('div'); badge.className='badge'; badge.textContent = r.timeLeftMin+'m';
    const btn = document.createElement('button'); btn.className='btn primary'; btn.textContent='Reservar';
    btn.onclick = ()=>openReserveModal(r);
    const contact = document.createElement('button'); contact.className='btn icon';
    contact.onclick = ()=>openContactModal(r);
    contact.innerHTML = '📞';
    contact.title = 'Contactar';
    const ignoreBtn = document.createElement('button'); ignoreBtn.className='btn ignore'; ignoreBtn.textContent='✖ Ignorar';
    ignoreBtn.onclick = ()=>ignoreRestaurant(r);
    aside.appendChild(badge); aside.appendChild(document.createElement('br')); aside.appendChild(document.createElement('br')); aside.appendChild(btn); aside.appendChild(contact); aside.appendChild(ignoreBtn);

    card.appendChild(meta); card.appendChild(aside);
    container.appendChild(card);
  });
  if(!any){
    container.innerHTML = '<div style="padding:18px;border-radius:12px;background:var(--card);text-align:center;color:var(--muted)">No hay ofertas ahora</div>'
  }
}

function ignoreRestaurant(restaurant){
  ignoredRestaurants.add(restaurant.id);
  renderRestaurants();
  toast(`Restaurante ignorado: ${restaurant.name}`);
}

function openContactModal(restaurant){
  $('#modal-title').textContent = `Contacto — ${restaurant.name}`;
  $('#modal-body').innerHTML = `Teléfono: <a href="tel:${restaurant.phone}" style="color:var(--green);font-weight:700">${restaurant.phone}</a>`;
  $('#modal').classList.remove('hidden');
  $('#confirmReserve').textContent = 'Llamar';
  $('#confirmReserve').onclick = ()=>{ location.href = `tel:${restaurant.phone}` };
  $('#cancelReserve').textContent = 'Cerrar';
  $('#cancelReserve').onclick = ()=>{ $('#modal').classList.add('hidden'); $('#confirmReserve').textContent='Reservar'; $('#cancelReserve').textContent='Cancelar'; };
}

function openReserveModal(restaurant){
  $('#modal-title').textContent = `Reservar en ${restaurant.name}`;
  $('#modal-body').textContent = `Ofertas: ${restaurant.items.map(i=>i.name+" (x"+i.qty+")").join(', ')}`;
  $('#modal').classList.remove('hidden');
  $('#confirmReserve').onclick = ()=>confirmReserve(restaurant);
  $('#cancelReserve').onclick = ()=>$('#modal').classList.add('hidden');
}

function confirmReserve(restaurant){
  const it = restaurant.items.find(i=>i.qty>0);
  if(!it){ alert('Lo siento, ya no hay unidades.'); $('#modal').classList.add('hidden'); return; }
  it.qty -= 1;
  $('#modal').classList.add('hidden');
  renderRestaurants();
  toast(`Reservado: ${it.name} en ${restaurant.name} — ${formatCurrency(it.offerPrice)}`);
  // mostrar notificación naranja en la parte inferior cuando el usuario reserva
  showNotification(restaurant, it);
  // add to reserved history with timestamp
  reservedHistory.unshift({ ts: new Date().toISOString(), restaurant: restaurant.name, item: it.name, price: it.offerPrice });
  if(reservedHistory.length>100) reservedHistory.pop();
}

function generatePassword(len){
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for(let i=0;i<len;i++) out += chars.charAt(Math.floor(Math.random()*chars.length));
  return out;
}

function login(){
  const email = (document.getElementById('loginEmail').value||'').trim();
  const pass = (document.getElementById('loginPassword').value||'').trim();
  if(!email || pass.length<8){ alert('Introduce un email válido y una contraseña de al menos 8 caracteres.'); return; }
  const nameInput = (document.getElementById('loginName').value||'').trim();
  const phoneInput = (document.getElementById('loginPhone').value||'').trim();
  const derivedName = nameInput || email.split('@')[0];
  currentUser = { fullName: derivedName, name: derivedName, phone: phoneInput || '', id: String(Math.floor(1000000000 + Math.random()*9000000000)) };
  document.getElementById('profileName').textContent = currentUser.fullName;
  document.getElementById('profilePhone').textContent = currentUser.phone ? `Tel: ${currentUser.phone}` : '';
  document.getElementById('profileId').textContent = `ID: ${currentUser.id}`;
  // ensure business dashboard is hidden for normal users
  document.getElementById('bizDashboard').classList.add('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContent').classList.remove('hidden');
  const mainLayout = document.querySelector('main.layout'); if(mainLayout) mainLayout.classList.remove('hidden');
  toast(`Bienvenido, ${currentUser.fullName}`);
}

function openPurchaseModal(){
  const list = document.getElementById('purchaseList');
  const cutoff = Date.now() - (30*24*60*60*1000); // 30 days
  const entries = reservedHistory.filter(r=> new Date(r.ts).getTime() >= cutoff);
  if(entries.length===0){ list.innerHTML = '<div style="padding:8px;color:var(--muted)">No hay pedidos reservados en el último mes.</div>'; }
  else{
    list.innerHTML = entries.map(e=>`<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)"><div style="font-weight:700">${e.restaurant}</div><div style="font-size:13px;color:var(--muted)">${new Date(e.ts).toLocaleString()} — ${e.item} — ${formatCurrency(e.price)}</div></div>`).join('');
  }
  document.getElementById('purchaseModal').classList.remove('hidden');
}

function logout(){
  // simple demo action: clear ignored restaurants and history
  ignoredRestaurants.clear();
  notificationsHistory = [];
  reservedHistory = [];
  toast('Sesión cerrada (demo)');
  // show login screen
  currentUser = null;
  // hide app content and any business dashboard
  document.getElementById('appContent').classList.add('hidden');
  document.getElementById('bizDashboard').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  // clear profile display
  document.getElementById('profileName').textContent = '';
  document.getElementById('profilePhone').textContent = '';
  document.getElementById('profileId').textContent = '';
}

function toast(msg){
  const el = document.createElement('div'); el.textContent=msg; el.style= 'position:fixed;right:18px;bottom:18px;background:var(--green);color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.12)';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

function showNotification(restaurant, item){
  const now = new Date();
  const pickup = new Date(now.getTime() + (restaurant.timeLeftMin * 60000));
  const hh = String(pickup.getHours()).padStart(2,'0');
  const mm = String(pickup.getMinutes()).padStart(2,'0');
  const note = document.createElement('div');
  note.className = 'popup-notice';
  note.innerHTML = `<div class="notice-content">⏰ <strong>${hh}:${mm}</strong> — Retiro en <span style="font-weight:700">${restaurant.name}</span><div style="margin-top:8px;color:rgba(255,255,255,0.95)">${item.name} — ${formatCurrency(item.offerPrice)}</div></div>`;
  document.body.appendChild(note);
  setTimeout(()=>{ note.classList.add('visible') }, 50);
  setTimeout(()=>{ note.classList.remove('visible'); setTimeout(()=>note.remove(),400) }, 4600);
  // store human-readable notification in history
  const text = `${hh}:${mm} — ${restaurant.name}: ${item.name} — ${formatCurrency(item.offerPrice)}`;
  notificationsHistory.unshift(text);
  if(notificationsHistory.length>20) notificationsHistory.pop();
}

function simulateRealtime(){
  setInterval(()=>{
    // decrement time left and randomly reduce quantities to simulate activity
    restaurants.forEach(r=>{
      if(r.timeLeftMin>0) r.timeLeftMin = Math.max(0, r.timeLeftMin - 1);
      r.items.forEach(it=>{
        if(it.qty>0 && Math.random()<0.06){ it.qty -= 1; }
      });
      // occasionally generate a new spontaneous offer for a random restaurant
      if(Math.random()<0.08){
        const target = restaurants[Math.floor(Math.random()*restaurants.length)];
        // only add if target currently has no available items
        const hasAvailable = target.items.some(i=>i.qty>0);
        if(!hasAvailable){
          // create a simple offer cloned from sample or create a small item
          const sampleNames = ['Ración del día','Caja sorpresa','Bocadillo express','Porción deli'];
          const name = sampleNames[Math.floor(Math.random()*sampleNames.length)];
          const base = 200 + Math.floor(Math.random()*800);
          // discount between 30-40%
          const disc = [30,35,40][Math.floor(Math.random()*3)];
          const offer = Math.round(base * (1 - disc/100));
          // set time between 10 and 25 minutes
          const timeMin = 10 + Math.floor(Math.random()*16); // 10..25
          const newItem = {name, qty: 3 + Math.floor(Math.random()*5), originalPrice: base, offerPrice: offer};
          target.items.push(newItem);
          target.timeLeftMin = timeMin;
          // Notify users about the new spontaneous offer
          try{
            showNotification(target, newItem);
          }catch(e){
            console.error('Failed to show notification for new offer', e);
          }
        }
      }
    });
    renderRestaurants();
  },3000);
}

window.addEventListener('DOMContentLoaded', load);
