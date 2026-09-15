(() => {
  const USERS = { ivan: "6a5b01acb5938854fb9425824d8b66d0b236e11bcf8085e016fde962fa5a7366", olga: "cf844fa2917431011c80365f3b9e71ced3527e2fa47406aabb52e228ce57c314" };
  const SESSION_PEPPER = "sales-plan-2026";
  const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2,"0")).join("");
  const cookie = name => document.cookie.split("; ").find(row => row.startsWith(`${name}=`))?.split("=")[1];
  const sessionProof = (user, expires) => hash(`${user}:${expires}:${SESSION_PEPPER}`);
  const activeUser = async () => { try { const data=JSON.parse(atob(decodeURIComponent(cookie("sales_plan_session") || ""))); return data.e > Date.now() && Object.hasOwn(USERS,data.u) && data.p === await sessionProof(data.u,data.e) ? data.u : ""; } catch { return ""; } };
  const cookieOptions = `max-age=${60*60*24*30}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  const createSession = async user => { const expires=Date.now()+30*24*60*60*1000, data={u:user,e:expires,p:await sessionProof(user,expires)}; document.cookie=`sales_plan_session=${encodeURIComponent(btoa(JSON.stringify(data)))}; ${cookieOptions}`; };
  const showApp = user => { document.body.classList.add("authenticated"); document.querySelector("#user-name").textContent = user; };
  document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault(); const name = document.querySelector("#login-name").value.trim().toLowerCase(), password = document.querySelector("#login-password").value;
    if (!Object.hasOwn(USERS,name) || USERS[name] !== await hash(password)) { document.querySelector("#login-error").textContent = "Неверное имя или пароль."; return; }
    await createSession(name);
    showApp(name); init();
  });
  document.querySelector("#logout").addEventListener("click", () => { document.cookie=`sales_plan_session=; max-age=0; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; location.reload(); });
  activeUser().then(user => { if (user) { showApp(user); init(); } });
  function init() {
  const BASE_RATE = 2740;
  const DAYS = 730;
  const KEY = "sales-plan-calendar-v1";
  const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const money = value => `${fmt.format(Math.round(value))} €`;
  const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const dayStart = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const parse = value => { const n = Number(String(value).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let state = load();
  const now = dayStart(new Date());
  if (!state.start || Number.isNaN(new Date(`${state.start}T00:00:00`).valueOf())) state.start = iso(now);
  if (!state.facts || typeof state.facts !== "object") state.facts = {};
  const start = dayStart(new Date(`${state.start}T00:00:00`));
  const dates = Array.from({ length:DAYS }, (_,i) => new Date(start.getFullYear(), start.getMonth(), start.getDate()+i));
  const inPlanToday = dates.some(d => iso(d) === iso(now));
  const effectiveToday = inPlanToday ? now : dates[0];
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const planRate = () => {
    const active = dates.filter(d => d >= effectiveToday);
    const actual = Object.values(state.facts).reduce((sum,v) => sum + (Number(v)||0), 0);
    return (BASE_RATE * DAYS - actual) / active.length;
  };
  const currentDay = () => dates.find(d => iso(d) === iso(effectiveToday));
  const update = () => {
    const rate = planRate(), actual = Object.values(state.facts).reduce((a,v)=>a+(Number(v)||0),0), remaining = BASE_RATE * DAYS - actual;
    document.querySelector("#current-rate").textContent = `${money(rate)} / день`;
    document.querySelector("#actual-total").textContent = money(actual);
    document.querySelector("#remaining-total").textContent = money(remaining);
    const date = currentDay();
    document.querySelector("#focus-date").textContent = iso(effectiveToday) === iso(now) ? "СЕГОДНЯ" : "АКТИВНЫЙ ДЕНЬ";
    document.querySelector("#focus-title").textContent = date.toLocaleDateString("ru-RU", {day:"numeric",month:"long",year:"numeric"});
    document.querySelector("#today-input").value = state.facts[iso(effectiveToday)] ?? "";
    renderCalendar(rate);
    updateClock(rate);
  };
  const updateClock = rate => {
    const moment = new Date(), seconds = moment.getHours()*3600 + moment.getMinutes()*60 + moment.getSeconds();
    document.querySelector("#earned-now").textContent = money(rate * seconds / 86400);
    document.querySelector("#clock-detail").textContent = `с начала дня · ${String(moment.getHours()).padStart(2,"0")}:${String(moment.getMinutes()).padStart(2,"0")}:${String(moment.getSeconds()).padStart(2,"0")}`;
  };
  const renderCalendar = rate => {
    const root = document.querySelector("#calendar"); root.innerHTML = "";
    const months = new Map(); dates.forEach(d => { const key=`${d.getFullYear()}-${d.getMonth()}`; if(!months.has(key)) months.set(key,[]); months.get(key).push(d); });
    for (const list of months.values()) {
      const first=list[0], fragment=document.createElement("section"); fragment.className="month";
      const title=first.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
      fragment.innerHTML=`<h3>${title}</h3><div class="weekdays"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="days"></div>`;
      const grid=fragment.querySelector(".days"), offset=(first.getDay()+6)%7; for(let i=0;i<offset;i++) { const e=document.createElement("div");e.className="day empty";grid.append(e); }
      list.forEach(d => { const key=iso(d), past=d<effectiveToday, active=key===iso(effectiveToday), cell=document.createElement("div"); cell.className=`day ${past?"past":active?"today":"future"}`;
        let body; if(past || active) body=`<input data-date="${key}" inputmode="decimal" aria-label="Факт за ${key}" value="${state.facts[key] ?? ""}" placeholder="факт">`; else body=`<span class="value">план ${money(rate)}</span>`;
        cell.innerHTML=`<span class="day-num">${d.getDate()}</span>${active?`<span class="value">план ${money(rate)}</span>`:""}${body}`; grid.append(cell);
      }); root.append(fragment);
    }
    root.querySelectorAll("input[data-date]").forEach(input => input.addEventListener("change", e => setFact(e.target.dataset.date,e.target.value)));
  };
  const setFact = (date,value) => { const amount=parse(value); if(amount === null) delete state.facts[date]; else state.facts[date]=amount; save(); update(); };
  document.querySelector("#today-input").addEventListener("change", e=>setFact(iso(effectiveToday),e.target.value));
  const dialog=document.querySelector("#confirm-dialog"); document.querySelector("#reset").onclick=()=>dialog.showModal(); document.querySelector("#cancel-reset").onclick=()=>dialog.close(); document.querySelector("#confirm-reset").onclick=()=>{state.facts={};save();dialog.close();update();};
  update();
  setInterval(() => updateClock(planRate()), 1000);
  }
})();
