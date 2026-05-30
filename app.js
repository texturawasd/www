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

function $(sel){return document.querySelector(sel)}

async function load(){
  const res = await fetch(DATA_URL);
  restaurants = await res.json();
  renderAccounts();
  renderRestaurants();
  simulateRealtime();
  // wire notifications button
  const nb = document.getElementById('notifBtn');
  const nm = document.getElementById('notifModal');
  nb.onclick = ()=>{ document.getElementById('notifList').innerHTML = notificationsHistory.length? notificationsHistory.map(n=>`<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)">${n}</div>`).join('') : '<div style="padding:8px;color:var(--muted)">No hay notificaciones guardadas.</div>'; nm.classList.remove('hidden'); };
  document.getElementById('closeNotif').onclick = ()=>{ nm.classList.add('hidden') };
}

function renderAccounts(){
  const sel = $('#demoAccount');
  demoAccounts.forEach(a=>{
    const opt = document.createElement('option'); opt.value=a.id; opt.textContent=a.name; sel.appendChild(opt);
  });
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
    const badge = document.createElement('div'); badge.className='badge'; badge.textContent = r.timeLeftMin+'m';
    const btn = document.createElement('button'); btn.className='btn primary'; btn.textContent='Reservar';
    btn.onclick = ()=>openReserveModal(r);
    const contact = document.createElement('button'); contact.className='btn'; contact.textContent='Contactar';
    contact.onclick = ()=>openContactModal(r);
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
          target.items.push({name, qty: 3 + Math.floor(Math.random()*5), originalPrice: base, offerPrice: offer});
          target.timeLeftMin = timeMin;
        }
      }
    });
    renderRestaurants();
  },3000);
}

window.addEventListener('DOMContentLoaded', load);
