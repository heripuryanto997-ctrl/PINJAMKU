const CFG = {
  APP_NAME: 'PINJAMKU',
  SHEETS: {
    USERS: 'Users',
    MEMBERS: 'Anggota',
    LOANS: 'Pinjaman',
    PAYMENTS: 'Angsuran',
    FINANCE: 'Keuangan'
  },
  SESSION_SECONDS: 21600,
  DEFAULT_ADMIN_USER: 'admin',
  DEFAULT_ADMIN_PASS: 'admin123!'
};

function doGet() {
  return json_({ ok: true, app: CFG.APP_NAME, message: 'PINJAMKU API aktif.' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');
    const data = body.data || {};
    let result;

    if (action === 'login') result = login_(data);
    else if (action === 'logout') result = logout_(data);
    else {
      const user = requireAuth_(data.token);
      switch (action) {
        case 'bootstrap': result = bootstrap_(user); break;
        case 'dashboard': result = dashboard_(user); break;
        case 'members.list': result = listMembers_(user); break;
        case 'members.save': result = saveMember_(user, data); break;
        case 'members.delete': result = deleteMember_(user, data); break;
        case 'loans.list': result = listLoans_(user); break;
        case 'loans.save': result = saveLoan_(user, data); break;
        case 'loans.delete': result = deleteLoan_(user, data); break;
        case 'payments.list': result = listPayments_(user, data); break;
        case 'payments.save': result = savePayment_(user, data); break;
        case 'finance.list': result = listFinance_(user, data); break;
        case 'finance.save': result = saveFinance_(user, data); break;
        case 'finance.delete': result = deleteFinance_(user, data); break;
        case 'reports': result = reports_(user, data); break;
        case 'password.change': result = changePassword_(user, data); break;
        default: throw new Error('Perintah tidak dikenal: ' + action);
      }
    }
    return json_({ ok: true, data: result });
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupPinjamku() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SPREADSHEET_ID');
  let ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Database PINJAMKU');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  const defs = [
    [CFG.SHEETS.USERS, ['UserID','Username','Role','MemberID','Salt','PasswordHash','Active','CreatedAt']],
    [CFG.SHEETS.MEMBERS, ['MemberID','Name','Address','Phone','Salt','PasswordHash','Active','CreatedAt']],
    [CFG.SHEETS.LOANS, ['LoanID','MemberID','Principal','Rate','Tenor','Interest','TotalDue','MonthlyDue','LoanDate','Notes','Status','CreatedAt']],
    [CFG.SHEETS.PAYMENTS, ['PaymentID','LoanID','MemberID','InstallmentNo','DueAmount','PaidAmount','PaidDate','Method','Notes','CreatedAt']],
    [CFG.SHEETS.FINANCE, ['FinanceID','Type','Date','Category','Amount','Description','CreatedAt']]
  ];
  defs.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#dbeafe');
    }
  });
  const users = sheet_(CFG.SHEETS.USERS);
  if (users.getLastRow() < 2) {
    const salt = Utilities.getUuid();
    users.appendRow([Utilities.getUuid(), CFG.DEFAULT_ADMIN_USER, 'admin', '', salt,
      hash_(CFG.DEFAULT_ADMIN_PASS, salt), true, new Date()]);
  }
  Logger.log('Database siap: ' + ss.getUrl());
  return ss.getUrl();
}

function db_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Database belum disiapkan. Jalankan setupPinjamku() terlebih dahulu.');
  return SpreadsheetApp.openById(id);
}
function sheet_(name) {
  const sh = db_().getSheetByName(name);
  if (!sh) throw new Error('Sheet tidak ditemukan: ' + name);
  return sh;
}
function rows_(name) {
  const sh = sheet_(name), values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(r => r.some(v => v !== '')).map(r => {
    const o = {};
    headers.forEach((h,i) => o[h] = r[i]);
    return o;
  });
}
function append_(name, row) { sheet_(name).appendRow(row); }
function findRow_(name, key, value) {
  const sh = sheet_(name), vals = sh.getDataRange().getValues();
  const idx = vals[0].indexOf(key);
  if (idx < 0) throw new Error('Kolom tidak ditemukan: ' + key);
  for (let i=1;i<vals.length;i++) if (String(vals[i][idx]) === String(value)) return i+1;
  return -1;
}
function updateById_(name, idKey, id, obj) {
  const sh = sheet_(name), vals = sh.getDataRange().getValues(), headers = vals[0];
  const row = findRow_(name, idKey, id);
  if (row < 0) throw new Error('Data tidak ditemukan.');
  headers.forEach((h,i) => { if (Object.prototype.hasOwnProperty.call(obj,h)) sh.getRange(row,i+1).setValue(obj[h]); });
}
function deleteById_(name, key, id) {
  const row = findRow_(name,key,id);
  if (row < 0) throw new Error('Data tidak ditemukan.');
  sheet_(name).deleteRow(row);
}
function id_() { return Utilities.getUuid(); }
function num_(v, label) {
  const n = Number(v);
  if (!isFinite(n) || n < 0) throw new Error((label || 'Nominal') + ' tidak valid.');
  return n;
}
function dateText_(v) {
  if (!v) return '';
  return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v).slice(0,10);
}
function hash_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function safeMember_(m) {
  return { memberId: String(m.MemberID), name: m.Name, address: m.Address, phone: m.Phone, active: m.Active !== false && String(m.Active) !== 'false' };
}
function login_(d) {
  const username = String(d.username || '').trim();
  const password = String(d.password || '');
  if (!username || !password) throw new Error('ID pengguna dan password wajib diisi.');
  const user = rows_(CFG.SHEETS.USERS).find(x => String(x.Username).toLowerCase() === username.toLowerCase() && String(x.Active) !== 'false');
  if (user && hash_(password, String(user.Salt)) === String(user.PasswordHash)) {
    return createSession_(user.Role, user.Username, user.MemberID || '', user.UserID);
  }
  const member = rows_(CFG.SHEETS.MEMBERS).find(x => String(x.MemberID).toLowerCase() === username.toLowerCase() && String(x.Active) !== 'false');
  if (member && member.PasswordHash && hash_(password, String(member.Salt)) === String(member.PasswordHash)) {
    return createSession_('member', member.MemberID, member.MemberID, member.MemberID);
  }
  throw new Error('ID atau password salah, atau akun tidak aktif.');
}
function createSession_(role, username, memberId, userId) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const session = { role: role, username: username, memberId: String(memberId || ''), userId: String(userId || '') };
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify(session), CFG.SESSION_SECONDS);
  return { token: token, user: session, expiresIn: CFG.SESSION_SECONDS };
}
function requireAuth_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  const raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  return JSON.parse(raw);
}
function admin_(u) { if (u.role !== 'admin') throw new Error('Akses khusus administrator.'); }
function logout_(d) {
  if (d.token) CacheService.getScriptCache().remove('sess_' + d.token);
  return { loggedOut: true };
}
function bootstrap_(u) {
  const member = u.role === 'member' ? rows_(CFG.SHEETS.MEMBERS).find(m => String(m.MemberID) === u.memberId) : null;
  return { user: u, member: member ? safeMember_(member) : null, appName: CFG.APP_NAME };
}
function listMembers_(u) {
  if (u.role === 'admin') return rows_(CFG.SHEETS.MEMBERS).map(safeMember_);
  return rows_(CFG.SHEETS.MEMBERS).filter(m => String(m.MemberID) === u.memberId).map(safeMember_);
}
function saveMember_(u,d) {
  admin_(u);
  const name = String(d.name || '').trim();
  if (!name) throw new Error('Nama anggota wajib diisi.');
  const memberId = String(d.memberId || '').trim() || ('AGT' + Date.now().toString().slice(-7));
  const sh = sheet_(CFG.SHEETS.MEMBERS);
  const existing = findRow_(CFG.SHEETS.MEMBERS, 'MemberID', memberId);
  const salt = Utilities.getUuid();
  const password = String(d.password || memberId);
  if (existing > 0) {
    const old = rows_(CFG.SHEETS.MEMBERS).find(x => String(x.MemberID) === memberId);
    const rowObj = { Name:name, Address:String(d.address||''), Phone:String(d.phone||''), Active:d.active !== false };
    if (d.password) { rowObj.Salt = salt; rowObj.PasswordHash = hash_(password,salt); }
    updateById_(CFG.SHEETS.MEMBERS,'MemberID',memberId,rowObj);
  } else {
    append_(CFG.SHEETS.MEMBERS,[memberId,name,String(d.address||''),String(d.phone||''),salt,hash_(password,salt),true,new Date()]);
  }
  return { memberId: memberId, initialPassword: existing < 0 ? password : undefined };
}
function deleteMember_(u,d) {
  admin_(u);
  const mid = String(d.memberId || '');
  if (rows_(CFG.SHEETS.LOANS).some(x => String(x.MemberID) === mid)) throw new Error('Anggota memiliki riwayat pinjaman. Nonaktifkan anggota, jangan hapus.');
  deleteById_(CFG.SHEETS.MEMBERS,'MemberID',mid);
  return { deleted:true };
}
function loanView_(loan) {
  const payments = rows_(CFG.SHEETS.PAYMENTS).filter(p => String(p.LoanID) === String(loan.LoanID));
  const paid = payments.reduce((s,p)=>s+Number(p.PaidAmount||0),0);
  return {
    loanId:String(loan.LoanID), memberId:String(loan.MemberID), principal:Number(loan.Principal),
    rate:Number(loan.Rate), tenor:Number(loan.Tenor), interest:Number(loan.Interest),
    totalDue:Number(loan.TotalDue), monthlyDue:Number(loan.MonthlyDue), loanDate:dateText_(loan.LoanDate),
    notes:loan.Notes||'', paid:paid, balance:Math.max(0,Number(loan.TotalDue)-paid),
    status: paid >= Number(loan.TotalDue) ? 'Lunas' : 'Berjalan',
    payments: payments.length
  };
}
function listLoans_(u) {
  const loans = rows_(CFG.SHEETS.LOANS);
  return loans.filter(l => u.role === 'admin' || String(l.MemberID) === u.memberId).map(loanView_);
}
function saveLoan_(u,d) {
  admin_(u);
  const mid=String(d.memberId||'');
  if (!rows_(CFG.SHEETS.MEMBERS).some(m=>String(m.MemberID)===mid && String(m.Active)!=='false')) throw new Error('Anggota tidak ditemukan/aktif.');
  const principal=num_(d.principal,'Pokok pinjaman');
  if (principal <= 0) throw new Error('Nominal pinjaman harus lebih dari nol.');
  const tenor=Number(d.tenor);
  if (!Number.isInteger(tenor)||tenor<1||tenor>10) throw new Error('Tenor harus 1 sampai 10 bulan.');
  const rate=num_(d.rate,'Bunga');
  const interest=principal*(rate/100)*tenor;
  const total=principal+interest;
  const monthly=total/tenor;
  const loanId=String(d.loanId||'');
  const values={MemberID:mid,Principal:principal,Rate:rate,Tenor:tenor,Interest:interest,TotalDue:total,MonthlyDue:monthly,LoanDate:d.loanDate||new Date(),Notes:String(d.notes||''),Status:'Berjalan'};
  if (loanId) {
    const old=loanView_(rows_(CFG.SHEETS.LOANS).find(x=>String(x.LoanID)===loanId)||{});
    if (old.payments>0) throw new Error('Pinjaman yang sudah memiliki angsuran tidak dapat diubah.');
    updateById_(CFG.SHEETS.LOANS,'LoanID',loanId,values);
  } else {
    append_(CFG.SHEETS.LOANS,[id_(),mid,principal,rate,tenor,interest,total,monthly,values.LoanDate,values.Notes,'Berjalan',new Date()]);
  }
  return { saved:true, totalDue:total, monthlyDue:monthly };
}
function deleteLoan_(u,d) {
  admin_(u);
  const loanId=String(d.loanId||'');
  if (rows_(CFG.SHEETS.PAYMENTS).some(p=>String(p.LoanID)===loanId)) throw new Error('Pinjaman memiliki transaksi angsuran dan tidak dapat dihapus.');
  deleteById_(CFG.SHEETS.LOANS,'LoanID',loanId);
  return {deleted:true};
}
function listPayments_(u,d) {
  const loans=listLoans_(u);
  const ids=loans.map(l=>l.loanId);
  return rows_(CFG.SHEETS.PAYMENTS).filter(p=>ids.includes(String(p.LoanID))).map(p=>({
    paymentId:String(p.PaymentID),loanId:String(p.LoanID),memberId:String(p.MemberID),
    installmentNo:Number(p.InstallmentNo),dueAmount:Number(p.DueAmount),paidAmount:Number(p.PaidAmount),
    paidDate:dateText_(p.PaidDate),method:p.Method||'',notes:p.Notes||''
  }));
}
function savePayment_(u,d) {
  admin_(u);
  const loan=rows_(CFG.SHEETS.LOANS).find(x=>String(x.LoanID)===String(d.loanId));
  if (!loan) throw new Error('Pinjaman tidak ditemukan.');
  const no=Number(d.installmentNo);
  if (!Number.isInteger(no)||no<1||no>Number(loan.Tenor)||no>10) throw new Error('Nomor angsuran di luar tenor pinjaman.');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (rows_(CFG.SHEETS.PAYMENTS).some(p=>String(p.LoanID)===String(loan.LoanID)&&Number(p.InstallmentNo)===no)) throw new Error('Angsuran ke-'+no+' sudah tercatat.');
    const due=Number(loan.MonthlyDue);
    const amount=num_(d.paidAmount === '' || d.paidAmount == null ? due : d.paidAmount,'Nominal pembayaran');
    if (amount<=0) throw new Error('Nominal pembayaran harus lebih dari nol.');
    const already=rows_(CFG.SHEETS.PAYMENTS).filter(p=>String(p.LoanID)===String(loan.LoanID)).reduce((s,p)=>s+Number(p.PaidAmount||0),0);
    if (amount>Number(loan.TotalDue)-already+0.01) throw new Error('Pembayaran melebihi sisa kewajiban pinjaman.');
    append_(CFG.SHEETS.PAYMENTS,[id_(),loan.LoanID,loan.MemberID,no,due,amount,d.PaidDate||new Date(),String(d.method||'Tunai'),String(d.notes||''),new Date()]);
  } finally { lock.releaseLock(); }
  return {saved:true};
}
function listFinance_(u,d) {
  admin_(u);
  return rows_(CFG.SHEETS.FINANCE).map(x=>({financeId:String(x.FinanceID),type:x.Type,date:dateText_(x.Date),category:x.Category,amount:Number(x.Amount),description:x.Description||''}));
}
function saveFinance_(u,d) {
  admin_(u);
  const type=String(d.type||'');
  if (!['Pemasukan','Pengeluaran'].includes(type)) throw new Error('Jenis transaksi tidak valid.');
  const amount=num_(d.amount,'Nominal');
  if (amount<=0) throw new Error('Nominal harus lebih dari nol.');
  const id=String(d.financeId||'');
  if (id) updateById_(CFG.SHEETS.FINANCE,'FinanceID',id,{Type:type,Date:d.date||new Date(),Category:String(d.category||''),Amount:amount,Description:String(d.description||'')});
  else append_(CFG.SHEETS.FINANCE,[id_(),type,d.date||new Date(),String(d.category||''),amount,String(d.description||''),new Date()]);
  return {saved:true};
}
function deleteFinance_(u,d) { admin_(u); deleteById_(CFG.SHEETS.FINANCE,'FinanceID',String(d.financeId||'')); return {deleted:true}; }
function reports_(u,d) {
  const loans=listLoans_(u), payments=listPayments_(u,{});
  const members=listMembers_(u);
  const memberMap={}; members.forEach(m=>memberMap[m.memberId]=m.name);
  return {loans:loans.map(l=>({...l,memberName:memberMap[l.memberId]||l.memberId})),
    payments:payments.map(p=>({...p,memberName:memberMap[p.memberId]||p.memberId})), members:members};
}
function dashboard_(u) {
  const loans=listLoans_(u), members=listMembers_(u);
  const payments=listPayments_(u,{});
  let income=0,expense=0;
  if (u.role==='admin') rows_(CFG.SHEETS.FINANCE).forEach(x=>{if(x.Type==='Pemasukan')income+=Number(x.Amount||0);else expense+=Number(x.Amount||0);});
  return {memberCount:members.length,borrowerCount:new Set(loans.map(x=>x.memberId)).size,
    principal:loans.reduce((s,x)=>s+x.principal,0),totalDue:loans.reduce((s,x)=>s+x.totalDue,0),
    paid:loans.reduce((s,x)=>s+x.paid,0),balance:loans.reduce((s,x)=>s+x.balance,0),
    income:income,expense:expense,paymentCount:payments.length,
    monthly:loans.map(x=>({label:x.loanDate,amount:x.principal})).slice(-8)};
}
function changePassword_(u,d) {
  const old=String(d.oldPassword||''), next=String(d.newPassword||'');
  if(next.length<8) throw new Error('Password baru minimal 8 karakter.');
  if(u.role==='admin') {
    const row=rows_(CFG.SHEETS.USERS).find(x=>String(x.Username)===u.username);
    if(!row||hash_(old,String(row.Salt))!==String(row.PasswordHash)) throw new Error('Password lama salah.');
    const salt=Utilities.getUuid(); updateById_(CFG.SHEETS.USERS,'UserID',row.UserID,{Salt:salt,PasswordHash:hash_(next,salt)});
  } else {
    const row=rows_(CFG.SHEETS.MEMBERS).find(x=>String(x.MemberID)===u.memberId);
    if(!row||hash_(old,String(row.Salt))!==String(row.PasswordHash)) throw new Error('Password lama salah.');
    const salt=Utilities.getUuid(); updateById_(CFG.SHEETS.MEMBERS,'MemberID',u.memberId,{Salt:salt,PasswordHash:hash_(next,salt)});
  }
  return {changed:true};
}
