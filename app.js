const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
  calendar:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4',
  people:'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M13.5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 8 M21 21v-2a4 4 0 0 0-3-4',
  folder:'M3 6h7l2 2h9v12H3z M8 14h8 M12 10v8',
  switch:'M3 8h17l-4-4 M21 16H4l4 4',
  plus:'M12 5v14 M5 12h14',
  check:'M4 12l5 5L20 6'
};
const icon = key => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';
const formatDate = date => new Intl.DateTimeFormat('es-PE', {dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const limaClock = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(new Date());
const relativeDay = offset => {
  const date = new Date(limaClock().slice(0,10)+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
};
const staff = {
  'Medicina general':['Dra. Valeria Torres','Dr. Martín Silva'],
  Cardiología:['Dr. Diego Rivas'],
  Pediatría:['Dra. Camila Núñez'],
  Dermatología:['Dra. Lucía Prado']
};
const demoDni = '00000001';
const demoPassword = '202600001';
const seed = {
  patients:[
    {dni:demoDni,name:'Ana García',pin:demoPassword},
    {dni:'87654321',name:'Luis Mendoza',pin:'1357'},
    {dni:'11223344',name:'Sofía Castillo',pin:'4321'}
  ],
  appointments:[
    {id:'a1',dni:demoDni,date:relativeDay(1),time:'09:30',specialty:'Medicina general',doctor:staff['Medicina general'][0],reason:'Control de seguimiento',status:'Programada'},
    {id:'a2',dni:'87654321',date:relativeDay(1),time:'10:30',specialty:'Cardiología',doctor:staff.Cardiología[0],reason:'Consulta de control',status:'Programada'},
    {id:'a3',dni:'11223344',date:relativeDay(2),time:'11:00',specialty:'Dermatología',doctor:staff.Dermatología[0],reason:'Primera consulta',status:'Programada'},
    {id:'a4',dni:demoDni,date:relativeDay(-7),time:'08:30',specialty:'Medicina general',doctor:staff['Medicina general'][0],reason:'Consulta de rutina',status:'Atendida'}
  ],
  records:[
    {dni:demoDni,date:relativeDay(-7),type:'Diagnóstico',title:'Consulta de medicina general',detail:'Evaluación de rutina registrada en la historia clínica de demostración.'},
    {dni:demoDni,date:relativeDay(-7),type:'Tratamiento',title:'Plan de seguimiento',detail:'Control en la próxima cita programada.'},
    {dni:demoDni,date:relativeDay(-20),type:'Antecedente',title:'Alergias registradas',detail:'Alergia a la penicilina registrada en la ficha ficticia.'}
  ]
};
const storageKey = 'medilink-demo-v1';
function readData(){
  try{
    const saved = JSON.parse(localStorage.getItem(storageKey)) ?? structuredClone(seed);
    const previousDni = '12345678';
    const demo = saved.patients.find(p=>p.dni===previousDni&&p.name==='Ana García'&&p.pin==='2468');
    if(demo&&!saved.patients.some(p=>p.dni===demoDni)){
      demo.dni=demoDni;
      demo.pin=demoPassword;
      for(const entry of [...saved.appointments,...saved.records]){
        if(entry.dni===previousDni)entry.dni=demoDni;
      }
    }
    return saved;
  }
  catch{return structuredClone(seed);}
}
let data = readData();
let role = 'welcome';
let patient = null;
let page = 'Elegir perfil';
let noticeTimer;
const view = $('view');
const dialog = $('dialog');
const button = (label,action,kind='',glyph='') => '<button type="button" class="btn '+kind+'" data-action="'+escape(action)+'">'+(glyph?icon(glyph):'')+escape(label)+'</button>';
const initials = name => name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
const person = p => '<div class="person"><span class="avatar">'+escape(initials(p.name))+'</span><div><strong>'+escape(p.name)+'</strong><small>DNI '+escape(p.dni)+'</small></div></div>';
const options = items => items.map(value=>'<option>'+escape(value)+'</option>').join('');
const title = (text,description,action='') => '<div class="page-title"><div><h1>'+text+'</h1><p>'+description+'</p></div>'+action+'</div>';
const heading = (name,subtitle='',action='') => '<div class="card-head"><div><h2>'+name+'</h2>'+(subtitle?'<p>'+subtitle+'</p>':'')+'</div>'+action+'</div>';
const empty = message => '<p class="empty">'+message+'</p>';
const timeOrder = (a,b) => (a.date+a.time).localeCompare(b.date+b.time);
const patientByDni = dni => data.patients.find(p=>p.dni===dni);
function flash(message){
  $('notice').textContent=message;
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>$('notice').textContent='',3500);
}
function save(next,message){
  try{localStorage.setItem(storageKey,JSON.stringify(next));}
  catch{throw new Error('El navegador no pudo guardar los cambios.');}
  data=next;
  if(dialog.open)dialog.close();
  render();
  flash(message);
}
function appointmentTable(rows,{actions=false,patientView=false}={}){
  if(!rows.length)return empty('No hay citas para mostrar.');
  const headings = [patientView?'Especialidad':'Paciente','Fecha y hora',patientView?'Profesional':'Especialidad','Estado',...(actions?['Acciones']:[])];
  return '<div class="table-wrap"><table><thead><tr>'+headings.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(a=>{
      const available=a.status==='Programada';
      const badge=a.status==='Atendida'?'done':a.status==='Cancelada'?'cancel':'';
      return '<tr><td>'+(patientView?'<strong>'+escape(a.specialty)+'</strong><small>'+escape(a.reason)+'</small>':person(patientByDni(a.dni)))+
        '</td><td><strong>'+formatDate(a.date)+'</strong><small>'+escape(a.time)+' h</small></td><td>'+
        (patientView?escape(a.doctor):'<strong>'+escape(a.specialty)+'</strong><small>'+escape(a.doctor)+'</small>')+
        '</td><td><span class="pill '+badge+'">'+a.status+'</span></td>'+
        (actions?'<td>'+(available?'<div class="actions">'+button('Editar','edit:'+a.id,'secondary small')+button('Atender','attend:'+a.id,'secondary small')+button('Cancelar','cancel:'+a.id,'secondary small danger')+'</div>':'—')+'</td>':'')+'</tr>';
    }).join('')+'</tbody></table></div>';
}
function dashboard(){
  const upcoming=data.appointments.filter(a=>a.status==='Programada' && a.date+' '+a.time>=limaClock()).sort(timeOrder);
  const metrics=[
    ['calendar',upcoming.length,'Citas próximas'],
    ['people',data.patients.length,'Pacientes registrados'],
    ['check',data.appointments.filter(a=>a.status==='Atendida').length,'Citas atendidas']
  ];
  return '<section class="hero"><div><div class="eyebrow">Panel de admisión</div><h1>Gestión hospitalaria</h1><p>Organiza las citas y fichas de tus pacientes.</p></div><div>'+button('Nueva cita','new','', 'plus')+'</div></section>'+
    '<section class="metrics" aria-label="Resumen">'+metrics.map(([glyph,count,label])=>'<div class="metric"><span class="metric-icon">'+icon(glyph)+'</span><div><strong>'+count+'</strong><span>'+label+'</span></div></div>').join('')+'</section>'+
    '<section class="card">'+heading('Próximas citas','Horario de Lima',button('Ver agenda','page:Agenda','secondary small'))+appointmentTable(upcoming.slice(0,5))+'</section>';
}
function agenda(){
  return title('Agenda de citas','Gestiona las citas del hospital.',button('Nueva cita','new','','plus'))+
    '<section class="card">'+heading('Citas registradas')+'<div class="filters"><input id="query" aria-label="Buscar por nombre o DNI" placeholder="Buscar por nombre o DNI"><input id="filter-date" type="date" aria-label="Fecha de cita"><select id="filter-status" aria-label="Estado"><option>Todos los estados</option>'+options(['Programada','Atendida','Cancelada'])+'</select></div><div id="results"></div></section>';
}
function patientDirectory(){
  return title('Pacientes','Busca a un paciente por su nombre o DNI.',button('Registrar paciente','register','','plus'))+
    '<section class="card">'+heading('Directorio de pacientes')+'<div class="filters"><input id="query" aria-label="Buscar pacientes" placeholder="Nombre o DNI"></div><div id="results"></div></section>';
}
function updateResults(){
  const query=$('query').value.trim().toLocaleLowerCase('es');
  const matches=p=>p.dni.includes(query)||p.name.toLocaleLowerCase('es').includes(query);
  if(page==='Agenda'){
    const status=$('filter-status').value;
    const date=$('filter-date').value;
    const rows=data.appointments.filter(a=>matches(patientByDni(a.dni))&&(!date||a.date===date)&&(status==='Todos los estados'||a.status===status)).sort(timeOrder);
    $('results').innerHTML=appointmentTable(rows,{actions:true});
    return;
  }
  const rows=data.patients.filter(matches);
  $('results').innerHTML=rows.length?'<div class="table-wrap"><table><thead><tr><th scope="col">Paciente</th><th scope="col">Acciones</th></tr></thead><tbody>'+rows.map(p=>'<tr><td>'+person(p)+'</td><td><div class="actions">'+button('Ver historial','profile:'+p.dni,'secondary small')+button('Agendar','new:'+p.dni,'secondary small')+'</div></td></tr>').join('')+'</tbody></table></div>':empty('No hay pacientes que coincidan con la búsqueda.');
}
function history(dni){
  const records=data.records.filter(r=>r.dni===dni).sort((a,b)=>b.date.localeCompare(a.date));
  return '<section class="card">'+heading('Historia clínica','Diagnósticos, tratamientos y antecedentes',role==='staff'?button('Añadir registro','record:'+dni,'secondary small','plus'):'')+
    (records.length?records.map(r=>'<article class="record"><span class="pill">'+escape(r.type)+'</span> <small>'+formatDate(r.date)+'</small><h3>'+escape(r.title)+'</h3><p>'+escape(r.detail)+'</p></article>').join(''):empty('Todavía no hay registros clínicos.'))+'</section>';
}
function login(){
  return '<section class="card login">'+heading('Portal del paciente','Ingresa tu DNI y tu clave de acceso.')+
    '<form class="form" data-form="login"><label>DNI<input name="dni" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" required></label><label>Clave de acceso<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,9}" maxlength="9" required></label><p class="error" role="alert" hidden></p><button class="btn">Ingresar</button></form></section>';
}
function render(){
  document.body.classList.toggle('welcome',role==='welcome');
  if(role==='welcome'||role==='staff-login'){
    $('navigation').innerHTML='';
    $('breadcrumb').textContent='Hospital Demo';
    $('avatar').textContent='ML';
    $('account').innerHTML='MediLink<small>Entorno de demostración</small>';
    if(role==='staff-login'){
      $('breadcrumb').textContent='Hospital Demo / Acceso de administrador';
      view.innerHTML='<section class="card login">'+heading('Acceso de administrador','Ingresa la contraseña para abrir el panel del hospital.')+
        '<form class="form" data-form="staff-login"><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><p class="error" role="alert" hidden></p><div class="form-actions">'+button('Volver','switch','secondary')+'<button class="btn">Ingresar</button></div></form></section>';
      return;
    }
    view.innerHTML=title('Bienvenido a MediLink','Elige el perfil con el que quieres ingresar.')+
      '<div class="role-grid"><section class="card role-card"><span class="metric-icon">'+icon('people')+'</span><h2>Administrador</h2><p>Gestiona pacientes, citas y registros clínicos desde el panel del hospital.</p>'+button('Ingresar como administrador','enter:staff-login')+'</section>'+
      '<section class="card role-card"><span class="metric-icon">'+icon('folder')+'</span><h2>Usuario</h2><p>Consulta tus citas y tu historial clínico con tu DNI y clave.</p>'+button('Ingresar como usuario','enter:patient','secondary')+'</section></div>';
    return;
  }
  const isStaff=role==='staff';
  const nav=isStaff?[['Inicio','home'],['Agenda','calendar'],['Pacientes','people']]:patient?[['Mis citas','calendar'],['Mi historial','folder']]:[['Acceso','folder']];
  $('navigation').innerHTML='<p class="nav-label">'+(isStaff?'Administración':'Portal del paciente')+'</p><nav class="nav" aria-label="Navegación principal">'+nav.map(([label,glyph])=>'<button type="button" '+(label===page?'class="active" aria-current="page" ':'')+'data-action="page:'+label+'">'+icon(glyph)+escape(label)+'</button>').join('')+'</nav><nav class="nav role-switch" aria-label="Cambio de perfil">'+
    (patient?'<button type="button" data-action="logout">'+icon('switch')+'Cerrar sesión</button>':'')+
    '<button type="button" data-action="switch">'+icon('switch')+'Cambiar de perfil</button></nav>';
  const name=isStaff?'Administrador':patient?.name??'Usuario';
  $('avatar').textContent=isStaff?'AD':initials(name);
  $('account').innerHTML=escape(name)+'<small>'+(isStaff?'Personal hospitalario':'Portal del paciente')+'</small>';
  $('breadcrumb').innerHTML='Hospital Demo <span>/</span> '+escape(page);
  if(!isStaff){
    view.innerHTML=!patient?login():page==='Mi historial'?title('Mi historial','Consulta tus registros en MediLink.')+history(patient.dni):title('Mis citas','Consulta la fecha, hora y estado de tus citas.')+'<section class="card">'+heading('Citas registradas','Horario de Lima')+appointmentTable(data.appointments.filter(a=>a.dni===patient.dni).sort(timeOrder),{patientView:true})+'</section>';
    return;
  }
  view.innerHTML=page==='Agenda'?agenda():page==='Pacientes'?patientDirectory():dashboard();
  if(page==='Agenda'||page==='Pacientes')updateResults();
}
function modal(name,form,fields,submit){
  $('dialog-content').innerHTML=heading(name,'',button('Cerrar','close','secondary small'))+
    '<form class="form" data-form="'+form+'">'+fields+'<p class="error" role="alert" hidden></p><div class="form-actions">'+button('Volver','close','secondary')+'<button class="btn">'+submit+'</button></div></form>';
  if(!dialog.open)dialog.showModal();
}
function appointmentForm(existing,dni){
  if(!data.patients.length){register();return;}
  const speciality=existing?.specialty??Object.keys(staff)[0];
  modal(existing?'Editar cita':'Nueva cita','appointment','<input type="hidden" name="id" value="'+escape(existing?.id)+'"><label>Paciente<select name="dni">'+data.patients.map(p=>'<option value="'+p.dni+'" '+(p.dni===(existing?.dni??dni)?'selected':'')+'>'+escape(p.name)+' · '+p.dni+'</option>').join('')+'</select></label>'+
    '<div class="form-row"><label>Especialidad<select name="specialty">'+options(Object.keys(staff))+'</select></label><label>Profesional<select name="doctor">'+options(staff[speciality])+'</select></label></div>'+
    '<div class="form-row"><label>Fecha<input name="date" type="date" min="'+relativeDay(0)+'" value="'+escape(existing?.date??relativeDay(0))+'" required></label><label>Hora de Lima<input name="time" type="time" value="'+escape(existing?.time)+'" required></label></div>'+
    '<label>Motivo de consulta<input name="reason" required maxlength="120" value="'+escape(existing?.reason)+'"></label>','Guardar cita');
  const form=dialog.querySelector('form');
  form.elements.specialty.value=speciality;
  if(existing)form.elements.doctor.value=existing.doctor;
  form.elements.specialty.addEventListener('change',()=>form.elements.doctor.innerHTML=options(staff[form.elements.specialty.value]));
}
function register(){
  modal('Registrar paciente','register','<label>Nombre completo<input name="name" required maxlength="80"></label><div class="form-row"><label>DNI de 8 dígitos<input name="dni" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" required></label><label>Clave de 4 dígitos<input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label></div><p class="help">Usa datos ficticios para la demostración.</p>','Registrar paciente');
}
function profile(p){
  $('dialog-content').innerHTML=heading(escape(p.name),'DNI '+p.dni,button('Cerrar','close','secondary small'))+history(p.dni);
  if(!dialog.open)dialog.showModal();
}
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  const [verb,id]=action.split(':');
  if(verb==='close'){dialog.close();return;}
  if(verb==='enter'||verb==='switch'||verb==='logout'){
    role=verb==='enter'?id:verb==='logout'?'patient':'welcome';
    patient=null;
    page=role==='staff'?'Inicio':role==='patient'?'Acceso':'Elegir perfil';
    render();
    return;
  }
  if(verb==='page'){page=id;render();return;}
  if(role!=='staff')return;
  if(verb==='new'){appointmentForm(null,id);return;}
  if(verb==='register'){register();return;}
  if(verb==='profile'){profile(patientByDni(id));return;}
  if(verb==='record'){
    modal('Añadir registro clínico','record','<input type="hidden" name="dni" value="'+id+'"><div class="form-row"><label>Tipo<select name="type">'+options(['Diagnóstico','Tratamiento','Antecedente'])+'</select></label><label>Fecha<input type="date" name="date" value="'+relativeDay(0)+'" max="'+relativeDay(0)+'" required></label></div><label>Título<input name="title" required maxlength="100"></label><label>Detalle<textarea name="detail" rows="4" required maxlength="1000"></textarea></label>','Guardar registro');
    return;
  }
  const appt=data.appointments.find(a=>a.id===id&&a.status==='Programada');
  if(!appt)return;
  if(verb==='edit'){appointmentForm(appt);return;}
  const cancel=verb==='cancel';
  modal(cancel?'Cancelar cita':'Marcar como atendida','status','<input type="hidden" name="id" value="'+id+'"><input type="hidden" name="status" value="'+(cancel?'Cancelada':'Atendida')+'"><p class="help">'+escape(patientByDni(appt.dni).name)+' · '+formatDate(appt.date)+' · '+escape(appt.time)+' h</p>',cancel?'Cancelar cita':'Confirmar atención');
});
view.addEventListener('input',event=>{
  if(event.target.closest('.filters'))updateResults();
});
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!form.dataset.form)return;
  event.preventDefault();
  const v=Object.fromEntries(new FormData(form));
  const error=form.querySelector('.error');
  const next=readData();
  try{
    if(form.dataset.form==='staff-login'){
      if(role!=='staff-login')return;
      if(v.password!==demoPassword)throw new Error('La contraseña es incorrecta.');
      role='staff';
      page='Inicio';
      data=next;
      render();
      return;
    }
    if(form.dataset.form==='login'){
      const match=next.patients.find(p=>p.dni===v.dni&&p.pin===v.pin);
      if(!match)throw new Error('El DNI o la clave de acceso son incorrectos.');
      data=next;
      patient=match;
      page='Mis citas';
      render();
      return;
    }
    if(role!=='staff')return;
    switch(form.dataset.form){
      case 'register':
        if(!v.name.trim())throw new Error('Escribe el nombre del paciente.');
        if(next.patients.some(p=>p.dni===v.dni))throw new Error('Ya existe un paciente con ese DNI.');
        next.patients.push({...v,name:v.name.trim()});
        page='Pacientes';
        save(next,'Paciente registrado.');
        break;
      case 'appointment': {
        if(!v.reason.trim())throw new Error('Escribe el motivo de consulta.');
        if(v.date+' '+v.time<limaClock())throw new Error('Elige una fecha y hora futuras.');
        const sameSlot=a=>a.id!==v.id&&a.status==='Programada'&&a.date===v.date&&a.time===v.time;
        if(next.appointments.some(a=>sameSlot(a)&&(a.doctor===v.doctor||a.dni===v.dni)))throw new Error('El profesional o el paciente ya tiene una cita a esa hora.');
        const appointment={...v,id:v.id||crypto.randomUUID(),reason:v.reason.trim(),status:'Programada'};
        if(v.id){
          const index=next.appointments.findIndex(a=>a.id===v.id&&a.status==='Programada');
          if(index<0)throw new Error('La cita ya no se puede editar.');
          next.appointments[index]=appointment;
        }else next.appointments.push(appointment);
        page='Agenda';
        save(next,v.id?'Cita actualizada.':'Cita programada.');
        break;
      }
      case 'status': {
        const appointment=next.appointments.find(a=>a.id===v.id&&a.status==='Programada');
        if(!appointment)throw new Error('El estado de la cita ya cambió.');
        appointment.status=v.status;
        save(next,v.status==='Cancelada'?'Cita cancelada.':'Cita marcada como atendida.');
        break;
      }
      case 'record':
        if(!v.title.trim()||!v.detail.trim())throw new Error('Completa el título y el detalle.');
        next.records.push({...v,title:v.title.trim(),detail:v.detail.trim()});
        save(next,'Registro clínico guardado.');
        profile(patientByDni(v.dni));
        break;
    }
  }catch(problem){error.textContent=problem.message;error.hidden=false;}
});
window.addEventListener('storage',event=>{
  if(event.key===storageKey||event.key===null){data=readData();render();}
});
render();
