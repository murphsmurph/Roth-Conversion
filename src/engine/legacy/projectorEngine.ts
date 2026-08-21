// @ts-nocheck
// LEGACY PROJECTOR ENGINE — faithful verbatim port of the multi-year simulation extracted from
// roth-conversion-projector.html (Phase 1). Constants remain inline pending migration to the
// versioned rules JSON in Phase 2; this file is intentionally excluded from the magic-number
// guard and from typechecking (@ts-nocheck). tools/build-site.mjs inlines it back into the HTML,
// so this module is the single source of truth for the deployed engine.
export function createProjectorEngine(S){
  // ===== 2026 federal data =====
  const STD={mfj:32200,single:16100};
  const STD65={mfj:1650,single:2050}; // additional per qualifying 65+ person
  const BR={mfj:[[0,.10],[24800,.12],[100800,.22],[211400,.24],[403550,.32],[512450,.35],[768700,.37]],
            single:[[0,.10],[12400,.12],[50400,.22],[105700,.24],[201775,.32],[256225,.35],[640600,.37]]};
  const SS_T={mfj:[32000,44000],single:[25000,34000]};
  const IRMAA={mfj:[218001,274001,342001,410001,750000],single:[109001,137001,171001,205001,500000]};
  const IRMAA_COST={mfj:[0,2297,5772,9240,12710,13872],single:[0,1148,2886,4620,6355,6936]};
  const LT={mfj:[98900,613700],single:[49450,545500]};   // 2026 LTCG 0/15/20 taxable-income thresholds
  const NIIT_THR={mfj:250000,single:200000};             // statutory, unindexed
  const QCD_LIMIT=111000;                                // 2026, per person 70.5+
  const ULT={73:26.5,74:25.5,75:24.6,76:23.7,77:22.9,78:22.0,79:21.1,80:20.2,81:19.4,82:18.5,83:17.7,84:16.8,85:16.0,86:15.2,87:14.4,88:13.7,89:12.9,90:12.2,91:11.5,92:10.8,93:10.1,94:9.5,95:8.9,96:8.4,97:7.8,98:7.3,99:6.8,100:6.4};

  // ===== state models (2026, simplified retirement treatment) =====
  // type: none | exempt | flat | grad. grad thresholds = single; doubled for mfj.
  const ST={
    AL:{n:"Alabama",t:"flat",r:.05}, AK:{n:"Alaska",t:"none"}, AZ:{n:"Arizona",t:"flat",r:.025},
    AR:{n:"Arkansas",t:"grad",b:[[0,.02],[4500,.039]]}, CA:{n:"California",t:"grad",b:[[0,.01],[10800,.02],[25600,.04],[40400,.06],[56100,.08],[70900,.093],[362000,.103],[434000,.113],[724000,.123]]},
    CO:{n:"Colorado",t:"flat",r:.044,ssDed65:true}, CT:{n:"Connecticut",t:"grad",b:[[0,.02],[10000,.045],[50000,.055],[100000,.06],[200000,.065],[250000,.069],[500000,.0699]]},
    DE:{n:"Delaware",t:"grad",b:[[0,0],[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066]]},
    DC:{n:"Washington DC",t:"grad",b:[[0,.04],[10000,.06],[40000,.065],[60000,.085],[250000,.0925],[500000,.0975],[1000000,.1075]]},
    FL:{n:"Florida",t:"none"}, GA:{n:"Georgia",t:"flat",r:.0539,retExcl:65000},
    HI:{n:"Hawaii",t:"grad",b:[[0,.014],[2400,.032],[4800,.055],[9600,.064],[14400,.068],[19200,.072],[24000,.076],[36000,.079],[48000,.0825],[150000,.09],[175000,.10],[200000,.11]]},
    ID:{n:"Idaho",t:"flat",r:.053}, IL:{n:"Illinois",t:"exempt"}, IN:{n:"Indiana",t:"flat",r:.03},
    IA:{n:"Iowa",t:"exempt"}, KS:{n:"Kansas",t:"grad",b:[[0,.052],[23000,.0558]]},
    KY:{n:"Kentucky",t:"flat",r:.04}, LA:{n:"Louisiana",t:"flat",r:.03},
    ME:{n:"Maine",t:"grad",b:[[0,.058],[26050,.0675],[61600,.0715]]}, MD:{n:"Maryland",t:"grad",b:[[0,.02],[1000,.03],[2000,.04],[3000,.0475],[100000,.05],[125000,.0525],[150000,.055],[250000,.0575]]},
    MA:{n:"Massachusetts",t:"flat",r:.05}, MI:{n:"Michigan",t:"flat",r:.0425,retExcl:60000},
    MN:{n:"Minnesota",t:"grad",b:[[0,.0535],[31690,.068],[103780,.0785],[193240,.0985]],ssTax:true},
    MS:{n:"Mississippi",t:"exempt"}, MO:{n:"Missouri",t:"grad",b:[[0,0],[1300,.02],[2700,.025],[4000,.03],[5400,.035],[6800,.0395]]},
    MT:{n:"Montana",t:"grad",b:[[0,.047],[20500,.059]]}, NE:{n:"Nebraska",t:"grad",b:[[0,.0246],[3900,.0351],[23400,.0501],[37700,.052]]},
    NV:{n:"Nevada",t:"none"}, NH:{n:"New Hampshire",t:"none"}, NJ:{n:"New Jersey",t:"grad",b:[[0,.014],[20000,.0175],[35000,.035],[40000,.05525],[75000,.0637],[500000,.0897],[1000000,.1075]],retExcl:100000},
    NM:{n:"New Mexico",t:"grad",b:[[0,.017],[5500,.032],[11000,.047],[16000,.049],[210000,.059]]}, NY:{n:"New York",t:"grad",b:[[0,.04],[8500,.045],[11700,.0525],[80650,.055],[215400,.06],[1077550,.0685]],retExcl:20000},
    NC:{n:"North Carolina",t:"flat",r:.0399}, ND:{n:"North Dakota",t:"grad",b:[[0,0],[47150,.0195],[238200,.025]]},
    OH:{n:"Ohio",t:"grad",b:[[0,0],[26050,.0275],[100000,.035]]}, OK:{n:"Oklahoma",t:"grad",b:[[0,.0025],[1000,.0075],[2500,.0175],[3750,.0275],[4900,.0375],[7200,.0475]]},
    OR:{n:"Oregon",t:"grad",b:[[0,.0475],[4300,.0675],[10750,.0875],[125000,.099]]}, PA:{n:"Pennsylvania",t:"exempt"},
    RI:{n:"Rhode Island",t:"grad",b:[[0,.0375],[77450,.0475],[176050,.0599]]}, SC:{n:"South Carolina",t:"grad",b:[[0,0],[3460,.03],[17330,.062]],retExcl:15000},
    SD:{n:"South Dakota",t:"none"}, TN:{n:"Tennessee",t:"none"}, TX:{n:"Texas",t:"none"},
    UT:{n:"Utah",t:"flat",r:.0455}, VT:{n:"Vermont",t:"grad",b:[[0,.0335],[45400,.066],[110050,.076],[229550,.0875]],ssTax:true},
    VA:{n:"Virginia",t:"grad",b:[[0,.02],[3000,.03],[5000,.05],[17000,.0575]]}, WA:{n:"Washington",t:"none"},
    WV:{n:"West Virginia",t:"grad",b:[[0,.0222],[10000,.0296],[25000,.0333],[40000,.0444],[60000,.0482]]},
    WI:{n:"Wisconsin",t:"grad",b:[[0,.035],[14680,.044],[29370,.053],[323290,.0765]]}, WY:{n:"Wyoming",t:"none"}
  };
  function stateTax(code,ti,fil){const s=ST[code];if(!s||s.t==="none"||s.t==="exempt")return 0;
    let inc=Math.max(0,ti-(s.retExcl||0));
    if(s.t==="flat")return inc*s.r;
    const b=s.b,m=fil==="mfj"?2:1;let t=0;
    for(let i=0;i<b.length;i++){const lo=b[i][0]*m,hi=i+1<b.length?b[i+1][0]*m:Infinity,r=b[i][1];
      if(inc>lo)t+=(Math.min(inc,hi)-lo)*r;else break;}return t;}
  function stateTopRate(code){const s=ST[code];if(!s||s.t==="none"||s.t==="exempt")return 0;
    if(s.t==="flat")return s.r;return s.b[s.b.length-1][1];}

  function ordTax(fil,ti){if(ti<=0)return 0;const b=BR[fil];let t=0;
    for(let i=0;i<b.length;i++){const lo=b[i][0],hi=i+1<b.length?b[i+1][0]:Infinity,r=b[i][1];
      if(ti>lo)t+=(Math.min(ti,hi)-lo)*r;else break;}return t;}
  function taxableSS(fil,ord,ss){if(ss<=0)return 0;const p=ord+0.5*ss,t=SS_T[fil],t1=t[0],t2=t[1];
    if(p<=t1)return 0;if(p<=t2)return Math.min(0.5*(p-t1),0.5*ss);
    const l=Math.min(0.5*(t2-t1),0.5*ss);return Math.min(0.85*(p-t2)+l,0.85*ss);}
  function fedTopRate(fil,ti){const b=BR[fil];let r=b[0][1];for(const x of b)if(ti>x[0])r=x[1];return r;}
  function bracketTop(fil,p){const b=BR[fil];for(let i=0;i<b.length;i++){if(Math.round(b[i][1]*100)===p)return i+1<b.length?b[i+1][0]:Infinity;}return b[2][0];}
  function nextIrmaa(fil,m){for(const f of IRMAA[fil])if(f>m)return f;return Infinity;}
  function irmaaCost(fil,m){const fl=IRMAA[fil];let tier=0;for(let i=0;i<fl.length;i++){if(m>=fl[i])tier=i+1;}return IRMAA_COST[fil][tier];}
  function rmdDiv(a){return ULT[a]||Math.max(3,6.4-(a-100)*0.4);}

  function effRateNow(){ // for display + traditional-withdrawal grossup
    const fil=S.married?"mfj":"single";
    const ssA=S.ssAgeA<=S.ageA?S.ssA:0, ssB=(S.married&&S.ssAgeB<=S.ageB)?S.ssB:0;
    const ssTax=taxableSS(fil,S.ord,ssA+ssB);
    const ti=Math.max(0,S.ord+ssTax-STD[fil]);
    return fedTopRate(fil,ti)+stateTopRate(S.state);
  }

  function ltcgTax(fil,ordTI,pref){if(pref<=0)return 0;const th=LT[fil],a2=th[0],b2=th[1],top=ordTI+pref;
    const p15=Math.max(0,Math.min(top,b2)-Math.max(ordTI,a2));
    const p20=Math.max(0,top-Math.max(ordTI,b2));
    return p15*.15+p20*.20;}
  function ltcgMarg(fil,stackTop){const th=LT[fil];return stackTop<th[0]?0:(stackTop<th[1]?0.15:0.20);}
  function niitTax(fil,magi,nii){return 0.038*Math.max(0,Math.min(nii,magi-NIIT_THR[fil]));}
  function run(doConvert,rets){
    // Per-year tax stack: ordinary brackets, SS provisional income, LTCG stacking (0/15/20),
    // 3.8% NIIT, IRMAA 2-yr lookback, QCDs (excluded from income & MAGI), Kotlikoff regime shift.
    // McQuarrie tax-drag engine: the taxable side-account's dividend/gain taxes flow through spending.
    // Conversion tax = yearStack(conv) - yearStack(0): the TRUE marginal cost, torpedo and all.
    let tradA=S.tradA,tradB=S.married?S.tradB:0,roth=S.roth;
    let txbl=S.cash, basis=S.cash*(S.basisPct/100);
    const rows=[];let tConv=0,tIncome=0,tIrmaa=0,tSS=0,tDrag=0,tNiit=0,tQcd=0,dep=null,survAge=null;
    let bothAlive=S.married;const magis=[];
    const DIVY=0.02; // qualified dividend yield on the taxable account
    for(let i=0,ageA=S.ageA;ageA<=S.endAge;ageA++,i++){
      const gr=rets?rets[i]:S.g;
      const ageB=S.ageB+i;
      if(S.married&&S.deathAgeA>0&&ageA>=S.deathAgeA&&bothAlive){bothAlive=false;survAge=ageA;
        if(S.firstGone==="B"){tradA+=tradB;tradB=0;}else{tradB+=tradA;tradA=0;}}
      const fil=bothAlive?"mfj":"single";
      const infl=Math.pow(1+S.inf,i);
      const ssA=ageA>=S.ssAgeA?S.ssA*infl:0;
      const ssB=(S.married&&ageB>=S.ssAgeB)?S.ssB*infl:0;
      const ssNow=bothAlive?(ssA+ssB):(S.married?Math.max(ssA,ssB):ssA);
      const ordNow=S.ord*infl, need=S.spend*infl;
      let rmd=0;
      if(ageA>=S.rmdAge&&tradA>0)rmd+=tradA/rmdDiv(ageA);
      if(bothAlive&&ageB>=S.rmdAge&&tradB>0)rmd+=tradB/rmdDiv(ageB);
      if(!bothAlive&&S.firstGone==="A"&&tradB>0&&ageB>=S.rmdAge)rmd+=tradB/rmdDiv(ageB);
      const trad=tradA+tradB;
      // QCD: IRA->charity direct; excluded from income & MAGI; satisfies the RMD first (70.5+ ~ age 71 in whole years)
      const eligQ=(ageA>=71?1:0)+(((bothAlive&&ageB>=71)||(!bothAlive&&S.firstGone==="A"&&ageB>=71))?1:0);
      const qcdWant=(ageA>=(S.qcdStart||0))?S.qcd:0;
      const qcd=Math.max(0,Math.min(qcdWant,QCD_LIMIT*eligQ,trad));
      const incomeRMD=Math.max(0,rmd-qcd);
      const iraOut=Math.max(rmd,qcd);
      tQcd+=qcd;
      const std=STD[fil]+(ageA>=65?STD65[fil]:0)+(bothAlive&&ageB>=65?STD65.mfj:0);
      let regMult=1;
      if(S.regime==="up"&&ageA>=S.rmdAge)regMult=1+S.regimePct/100;
      else if(S.regime==="down"&&ageA>=S.rmdAge)regMult=1-S.regimePct/100;
      const div=txbl*DIVY;
      const yearStack=function(c){
        const ssT=taxableSS(fil,ordNow+incomeRMD+c,ssNow);
        const ordInc=ordNow+incomeRMD+c+ssT;
        const ti=Math.max(0,ordInc-std);
        const shelter=Math.max(0,std-ordInc);       // leftover deduction shelters preferential income
        const pref=Math.max(0,div-shelter);
        const fed=ordTax(fil,ti)*regMult;
        const stt=stateTax(S.state,ti+pref,fil)*regMult;  // states tax gains/divs as ordinary income
        const cg=ltcgTax(fil,ti,pref)*regMult;
        const magi=ordNow+incomeRMD+c+ssT+div;
        const nii=niitTax(fil,magi,div);
        return {ssT:ssT,ti:ti,pref:pref,fed:fed,stt:stt,cg:cg,nii:nii,magi:magi,tot:fed+stt+cg+nii};
      };
      let conv=0;
      if(doConvert&&ageA<S.stopAge&&trad-iraOut>0){
        if(S.mode==="fixed"){conv=S.fixedAmt;}
        else{const b0=yearStack(0);
          conv=Math.max(0,bracketTop(fil,S.fillBkt)-b0.ti);
          const ir=Math.max(0,nextIrmaa(fil,b0.magi)-b0.magi);
          if(ir>0)conv=Math.min(conv,ir);}
        conv=Math.max(0,Math.min(conv,trad-iraOut));
      }
      const base=yearStack(0), full=yearStack(conv);
      const convTax=Math.max(0,full.tot-base.tot);   // TRUE marginal tax on the conversion
      const torpedo=Math.max(0,full.ssT-base.ssT);   // SS dragged into taxation by the conversion
      // cgR: marginal rate on realized long-term gains (stacked LTCG rate + NIIT when active)
      const cgR=Math.min(0.5,(ltcgMarg(fil,full.ti+full.pref)+(full.nii>0?0.038:0))*regMult);
      // Progressive, self-consistent taxation of EXTRA ordinary withdrawals (to pay conversion tax or
      // fund spending). Each extra IRA dollar is stacked on the year's income through the full
      // bracket / SS-provisional / NIIT machinery (yearStack) instead of a flat marginal rate; the
      // gross-up solves the fixed point W - tax(W) = cash needed. Every such tax is booked to THIS
      // year, so the year-by-year table reconciles exactly to the lifetime-tax totals.
      let ordLayer=conv, realizedGains=0;
      const grossTrad=function(R){ if(R<=0)return 0; let W=R;
        for(let k=0;k<24;k++){const t=yearStack(ordLayer+W).tot-yearStack(ordLayer).tot,nW=R+t;
          if(Math.abs(nW-W)<0.05){W=nW;break;}W=nW;} return W;};
      const pullTrad=function(gross){const avail=tradA+tradB,used=Math.min(gross,Math.max(0,avail));
        if(avail>0){tradA-=used*tradA/avail;tradB-=used*tradB/avail;}ordLayer+=used;return used;};
      txbl=txbl*(1+gr);basis+=div;
      if(conv>0){const tt=tradA+tradB||1;tradA-=conv*tradA/tt;tradB-=conv*tradB/tt;roth+=conv;}
      if(conv>0&&convTax>0){
        let cashNeed=convTax;
        if(S.paySrc==="outside"){
          const gainFrac=txbl>0?Math.max(0,(txbl-basis)/txbl):0;
          const grossNeeded=cashNeed/Math.max(1e-9,(1-gainFrac*cgR));
          const pull=Math.min(txbl,grossNeeded);
          realizedGains+=pull*gainFrac;basis-=pull*(1-gainFrac);txbl-=pull;
          cashNeed-=pull*(1-gainFrac*cgR);
          if(cashNeed>0.01)pullTrad(grossTrad(cashNeed));   // outside cash short -> pull from IRA, grossed up
        }else{pullTrad(grossTrad(cashNeed));}               // pay the conversion tax from the IRA
      }
      if(iraOut>0){const tt=tradA+tradB||1;tradA-=iraOut*tradA/tt;tradB-=iraOut*tradB/tt;}
      // IRMAA: 2-yr MAGI lookback, prorated to the number of spouses actually enrolled in Medicare (65+)
      const on65=(ageA>=65?1:0)+((bothAlive&&ageB>=65)?1:0);
      const lbMagi=i>=2?magis[i-2]:full.magi;
      let irmaa=0;
      if(on65>0){const fl=IRMAA[fil];let tier=0;for(let z=0;z<fl.length;z++){if(lbMagi>=fl[z])tier=z+1;}
        irmaa=on65*IRMAA_COST.single[tier];}
      // spending: the conversion's tax was funded above; base-year tax flows through here (no double charge)
      const spendTax=base.tot+irmaa;
      let net=(need+spendTax)-(ssNow+ordNow+incomeRMD);
      if(net<=0){
        if(S.reinvest){const surplus=-net;txbl+=surplus;basis+=surplus;}
      }else{
        let rem=net;
        const gf=txbl>0?Math.max(0,(txbl-basis)/txbl):0;
        const grossTx=Math.min(txbl,rem/Math.max(1e-9,(1-gf*cgR)));   // sell taxable, grossed up for its gains tax
        if(grossTx>0){realizedGains+=grossTx*gf;basis-=grossTx*(1-gf);txbl-=grossTx;rem-=grossTx*(1-gf*cgR);}
        if(rem>0){const pre=ordLayer,used=pullTrad(grossTrad(rem));    // draw IRA with progressive gross-up
          const tax=yearStack(ordLayer).tot-yearStack(pre).tot;rem-=(used-tax);}
        if(rem>0){const fr=Math.min(roth,rem);roth-=fr;rem-=fr;}
        if(rem>0.5&&dep===null)dep=ageA;
      }
      // final, fully-integrated tax picture for the year (base income + conversion + every extra withdrawal)
      const fin=yearStack(ordLayer);
      magis.push(fin.magi+realizedGains);            // MAGI now reflects realized gains + extra IRA withdrawals
      const ssTaxed=fin.ssT;tSS+=ssTaxed;
      const gainsTax=realizedGains*cgR;
      const incomeTax=fin.fed+fin.stt+fin.cg+gainsTax;
      const niit=fin.nii;tNiit+=niit;
      const drag=fin.cg+fin.nii+gainsTax;tDrag+=drag;
      const yrTax=incomeTax+niit+irmaa;
      tIncome+=incomeTax;tIrmaa+=irmaa;tConv+=conv;
      tradA=Math.max(0,tradA);tradB=Math.max(0,tradB);txbl=Math.max(0,txbl);basis=Math.max(0,Math.min(basis,txbl));
      const tradTot=tradA+tradB;
      const depleted=(tradTot+roth+txbl)<=1;if(depleted&&dep===null)dep=ageA;
      const txblNet=txbl-Math.max(0,txbl-basis)*Math.max(0.15,cgR);
      rows.push({ageA:ageA,ageB:S.married?ageB:null,fil:fil,single:fil==="single"&&S.married,rmd:rmd,qcd:qcd,conv:conv,convTax:convTax,
        torpedo:torpedo,effMarg:conv>0?convTax/conv:0,ssTaxed:ssTaxed,ssNow:ssNow,need:need,ti:fin.ti,fed:fin.fed,stt:fin.stt,
        cg:fin.cg+gainsTax,niit:niit,drag:drag,incomeTax:incomeTax,irmaa:irmaa,yearTax:yrTax,bracket:fedTopRate(fil,fin.ti),
        trad:tradTot,roth:Math.max(0,roth),cash:txbl,cashNet:txblNet,
        total:tradTot+Math.max(0,roth)+txbl,depleted:depleted});
      tradA*=(1+gr);tradB*=(1+gr);roth=Math.max(0,roth)*(1+gr);
    }
    const last=rows[rows.length-1];
    return {rows:rows,tConv:tConv,tIncome:tIncome,tIrmaa:tIrmaa,tSS:tSS,tDrag:tDrag,tNiit:tNiit,tQcd:tQcd,
      lifeTax:tIncome+tNiit+tIrmaa,dep:dep,survAge:survAge,tradEnd:last.trad,
      legChildren:last.roth+last.trad*(1-S.heir)+last.cashNet,
      legSurvivor:last.roth+last.trad*(1-S.surv)+last.cashNet};
  }
  function legacyPath(res,rate){return res.rows.map(r=>r.roth+r.trad*(1-rate)+r.cashNet);}
  // Estate-tax + IRD/691(c) legacy (Keebler). Values the final estate after estate tax AND income tax,
  // capturing that the 691(c) deduction offsets only FEDERAL estate tax, not state estate tax.
  function estateLegacy(res,doConvert){
    const last=res.rows[res.length-1]||res.rows[res.rows.length-1];
    const roth=last.roth, trad=last.trad, taxable=last.cashNet, other=S.otherEstate;
    const heir=S.heir, fE=S.fedEstRate/100, sE=S.stEstRate/100;
    // gross estate
    const grossEstate=roth+trad+taxable+other;
    // state estate tax (no 691c relief) and federal estate tax (above exemptions)
    const stEstTax=Math.max(0,grossEstate-S.stExempt)*sE;
    const fedEstTax=Math.max(0,grossEstate-stEstTax-S.fedExempt)*fE;
    // income tax (IRD) only on the traditional balance; 691(c) deducts the FEDERAL estate tax attributable to the IRA
    const iraFracOfEstate = grossEstate>0 ? trad/grossEstate : 0;
    const fedEstTaxOnIRA = fedEstTax*iraFracOfEstate;
    const iraSubjToInc = Math.max(0, trad - fedEstTaxOnIRA); // 691(c): deduct fed estate tax on IRD
    const incTaxOnIRA = iraSubjToInc*heir; // heir pays income tax on inherited traditional
    const net = grossEstate - stEstTax - fedEstTax - incTaxOnIRA;
    return {grossEstate,stEstTax,fedEstTax,incTaxOnIRA,net};
  }
  // breakeven: first age where convert legacy >= do-nothing legacy, year by year
  function breakevenAge(conv,noth,rate){
    const c=legacyPath(conv,rate),n=legacyPath(noth,rate);
    for(let i=0;i<c.length;i++){if(c[i]>=n[i])return conv.rows[i].ageA;}
    return null;
  }

  function validate(){const e=[];
    if(S.endAge<=S.ageA)e.push("Projection end age must exceed Spouse A\u2019s age \u2014 clamped to "+(S.ageA+1)+".");
    if(S.ageA<40||S.ageA>100)e.push("Spouse A age of "+S.ageA+" looks off.");
    if(S.married&&(S.ageB<40||S.ageB>100))e.push("Spouse B age of "+S.ageB+" looks off.");
    if(S.ssA>0&&(S.ssAgeA<62||S.ssAgeA>70))e.push("Spouse A\u2019s SS claiming age must be 62\u201370.");
    if(S.married&&S.ssB>0&&(S.ssAgeB<62||S.ssAgeB>70))e.push("Spouse B\u2019s SS claiming age must be 62\u201370.");
    if(S.stopAge<=S.ageA)e.push("Stop-converting age is not after the current age \u2014 the convert plan converts nothing.");
    if(S.married&&S.deathAgeA>0&&(S.deathAgeA<S.ageA||S.deathAgeA>S.endAge))e.push("Survivor-transition age falls outside the projection window.");
    if(S.growth<-5||S.growth>15)e.push("Growth of "+S.growth+"%/yr is outside a plausible planning range (\u22125 to 15).");
    if(S.vol<0||S.vol>40)e.push("Volatility should be between 0 and 40%.");
    if(S.spend<=0)e.push("Living expenses are zero \u2014 the spending plan is empty.");
    if([10,12,22,24,32,35,37].indexOf(S.fillBkt)<0)e.push("Fill-to bracket must be one of 10, 12, 22, 24, 32, 35, 37 \u2014 using 22.");
    if(S.qcd>QCD_LIMIT*(S.married?2:1))e.push("QCD capped at the 2026 limit of $111,000 per person 70\u00bd+.");
    if(S.qcd>0&&S.qcdStart>0&&S.qcdStart<71)e.push("QCD eligibility begins at 70\u00bd \u2014 amounts before age 71 are not applied.");
    return e;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let x=Math.imul(a^a>>>15,1|a);x=x+Math.imul(x^x>>>7,61|x)^x;return((x^x>>>14)>>>0)/4294967296;};}
  function monteCarlo(){
    const N=400,yrs=S.endAge-S.ageA+1,rnd=mulberry32(0x5F3B21),vol=S.vol/100;
    const legC=[],legN=[];let okC=0,okN=0,wins=0;
    for(let s=0;s<N;s++){
      const rets=[];
      for(let y=0;y<yrs;y+=2){const u1=Math.max(1e-9,rnd()),u2=rnd(),m=Math.sqrt(-2*Math.log(u1));
        rets.push(Math.max(-0.95,S.g+vol*m*Math.cos(2*Math.PI*u2)));
        if(y+1<yrs)rets.push(Math.max(-0.95,S.g+vol*m*Math.sin(2*Math.PI*u2)));}
      const c=run(true,rets),n=run(false,rets);   // same market path for both plans
      if(c.dep===null)okC++;if(n.dep===null)okN++;
      legC.push(c.legChildren);legN.push(n.legChildren);
      if(c.legChildren>=n.legChildren)wins++;
    }
    const pct=function(arr,p){const a2=arr.slice().sort(function(x,y){return x-y;});return a2[Math.min(a2.length-1,Math.floor(p*a2.length))];};
    return {sC:100*okC/N,sN:100*okN/N,winPct:100*wins/N,
      medC:pct(legC,0.5),loC:pct(legC,0.1),hiC:pct(legC,0.9),
      medN:pct(legN,0.5),loN:pct(legN,0.1),hiN:pct(legN,0.9)};
  }
  function deflateRes(res){
    const F=["rmd","qcd","conv","convTax","torpedo","ssTaxed","ssNow","need","ti","fed","stt","cg","niit","incomeTax","irmaa","yearTax","trad","roth","cash","cashNet","total","drag"];
    const rows=res.rows.map(function(r,i){const d=Math.pow(1+S.inf,i),o=Object.assign({},r);F.forEach(function(f){o[f]=r[f]/d;});return o;});
    const sum=function(f){return rows.reduce(function(a2,r){return a2+r[f];},0);};
    const last=rows[rows.length-1];
    return Object.assign({},res,{rows:rows,tConv:sum("conv"),tIncome:sum("incomeTax"),tIrmaa:sum("irmaa"),tNiit:sum("niit"),tSS:sum("ssTaxed"),tDrag:sum("drag"),tQcd:sum("qcd"),
      lifeTax:sum("incomeTax")+sum("niit")+sum("irmaa"),
      legChildren:last.roth+last.trad*(1-S.heir)+last.cashNet,
      legSurvivor:last.roth+last.trad*(1-S.surv)+last.cashNet});
  }
  return { run, deflateRes, estateLegacy, breakevenAge, legacyPath, validate, effRateNow, monteCarlo, ST };
}
