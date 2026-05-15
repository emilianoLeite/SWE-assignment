import mongoose, { Connection, Schema, Types } from 'mongoose';

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

// ── inline schema definitions (no NestJS decorators needed here) ──────────────

const operatorSchema = new Schema({ name: String, email: String }, { timestamps: true });

const customerSchema = new Schema(
  {
    brandId: Schema.Types.ObjectId,
    name: String,
    email: String,
    phone: String,
    lifetimeSpend: { type: Number, default: 0 },
    tags: [String],
    notes: String,
    visitorId: String,
    lastOrder: { id: String, placedAt: Date },
    lastActivityAt: Date,
  },
  { timestamps: true },
);
customerSchema.index({ brandId: 1, lastActivityAt: -1 });
customerSchema.index({ brandId: 1, status: 1, lastActivityAt: -1 });

const transcriptLineSchema = new Schema({ speaker: String, text: String }, { _id: false });
const channelDataSchema = new Schema(
  { subject: String, duration: String, outcome: String, transcript: [transcriptLineSchema] },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    brandId: Schema.Types.ObjectId,
    customerId: Schema.Types.ObjectId,
    channel: String,
    status: String,
    type: String,
    assigneeId: { type: Schema.Types.ObjectId, default: null },
    aiActive: { type: Boolean, default: true },
    campaign: { type: String, default: null },
    lastActivityAt: Date,
    channelData: { type: channelDataSchema, default: () => ({}) },
  },
  { timestamps: true },
);
conversationSchema.index({ brandId: 1, lastActivityAt: -1 });
conversationSchema.index({ brandId: 1, status: 1, lastActivityAt: -1 });
conversationSchema.index({ brandId: 1, channel: 1, status: 1, lastActivityAt: -1 });
conversationSchema.index({ brandId: 1, type: 1, lastActivityAt: -1 });

const attachmentSchema = new Schema(
  { filename: String, size: Number, mimeType: String },
  { _id: false },
);

const messageSchema = new Schema(
  {
    conversationId: Schema.Types.ObjectId,
    sentBy: String,
    content: String,
    type: { type: String, default: 'text' },
    sentAt: Date,
    attachments: { type: [attachmentSchema], default: undefined },
  },
  { timestamps: false },
);
messageSchema.index({ conversationId: 1, sentAt: 1 });

// ── seed ─────────────────────────────────────────────────────────────────────

export async function runSeed(conn: Connection): Promise<void> {
  const Operator = conn.model('Operator', operatorSchema, 'operators');
  const Customer = conn.model('Customer', customerSchema, 'customers');
  const Conversation = conn.model('Conversation', conversationSchema, 'conversations');
  const Message = conn.model('Message', messageSchema, 'messages');

  await Promise.all([
    Operator.deleteMany({}),
    Customer.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
  ]);

  await Promise.all([
    Customer.createIndexes(),
    Conversation.createIndexes(),
    Message.createIndexes(),
  ]);

  // ── brand ────────────────────────────────────────────────────────────────
  const BRAND_ID = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');

  // ── operators ────────────────────────────────────────────────────────────
  const [marco, giulia, luca, sofia] = await Operator.insertMany([
    { name: 'Marco Rossi', email: 'marco.rossi@textyess.com' },
    { name: 'Giulia Bianchi', email: 'giulia.bianchi@textyess.com' },
    { name: 'Luca Ferrari', email: 'luca.ferrari@textyess.com' },
    { name: 'Sofia Esposito', email: 'sofia.esposito@textyess.com' },
  ]);

  // ── customers ────────────────────────────────────────────────────────────
  // lastActivityAt will be back-filled after messages are created
  const [anna, roberto, chiara, davide, elena] = await Customer.insertMany([
    {
      brandId: BRAND_ID,
      name: 'Anna Conti',
      email: 'anna.conti@email.it',
      phone: '+39 339 1234567',
      lifetimeSpend: 1240,
      tags: ['vip', 'abbonata'],
      notes: 'Cliente fedele dal 2021.',
      lastOrder: { id: 'ORD-10021', placedAt: daysAgo(3) },
      lastActivityAt: daysAgo(3),
    },
    {
      brandId: BRAND_ID,
      name: 'Roberto Mancini',
      email: 'roberto.mancini@gmail.com',
      phone: '+39 347 9876543',
      lifetimeSpend: 340,
      tags: ['promo'],
      lastOrder: { id: 'ORD-10045', placedAt: daysAgo(8) },
      lastActivityAt: daysAgo(8),
    },
    {
      brandId: BRAND_ID,
      name: 'Chiara Lombardi',
      email: 'chiara.lombardi@libero.it',
      lifetimeSpend: 780,
      tags: ['newsletter'],
      lastOrder: { id: 'ORD-10033', placedAt: daysAgo(12) },
      lastActivityAt: daysAgo(12),
    },
    {
      brandId: BRAND_ID,
      name: 'Davide Russo',
      email: 'davide.russo@yahoo.it',
      phone: '+39 333 5556677',
      lifetimeSpend: 520,
      tags: [],
      lastActivityAt: daysAgo(5),
    },
    {
      brandId: BRAND_ID,
      name: 'Elena Martinelli',
      email: 'elena.martinelli@gmail.com',
      phone: '+39 320 4443322',
      lifetimeSpend: 1890,
      tags: ['vip', 'influencer'],
      visitorId: 'vis_elena_001',
      lastOrder: { id: 'ORD-10067', placedAt: daysAgo(1) },
      lastActivityAt: daysAgo(1),
    },
  ]);

  // ── conversations ─────────────────────────────────────────────────────────
  const [
    annaWa,     // whatsapp / to_manage   / inbound
    annaEmail,  // email    / managed      / inbound
    annaVoice,  // voice    / ai_controlled/ inbound  — transcript only
    robertoWa,  // whatsapp / blocked      / inbound
    robertoOs,  // onsite   / ai_controlled/ outbound
    chiaraEmail,// email    / to_manage    / inbound
    chiaraEmailOut, // email / managed     / outbound
    davideVoice,// voice    / human_controlled / inbound — transcript only
    davideEmail,// email    / ai_controlled / inbound
    elenaWa,    // whatsapp / managed      / inbound
    elenaOs,    // onsite   / to_manage    / outbound
    elenaEmail, // email    / blocked      / inbound
  ] = await Conversation.insertMany([
    {
      brandId: BRAND_ID,
      customerId: anna._id,
      channel: 'whatsapp',
      status: 'to_manage',
      type: 'inbound',
      assigneeId: marco._id,
      aiActive: false,
      lastActivityAt: hoursAgo(2),
    },
    {
      brandId: BRAND_ID,
      customerId: anna._id,
      channel: 'email',
      status: 'managed',
      type: 'inbound',
      assigneeId: marco._id,
      aiActive: false,
      lastActivityAt: daysAgo(4),
      channelData: { subject: 'Richiesta rimborso ordine #10021' },
    },
    {
      brandId: BRAND_ID,
      customerId: anna._id,
      channel: 'voice',
      status: 'ai_controlled',
      type: 'inbound',
      aiActive: true,
      lastActivityAt: daysAgo(6),
      channelData: {
        duration: '4:32',
        outcome: 'Successful',
        transcript: [
          { speaker: 'ai', text: 'Buongiorno, come posso aiutarla?' },
          { speaker: 'customer', text: 'Volevo informazioni sul mio ordine #10021.' },
          { speaker: 'ai', text: 'Il suo ordine è in consegna, arriverà domani.' },
          { speaker: 'customer', text: 'Perfetto, grazie mille!' },
          { speaker: 'ai', text: 'Prego! Ha bisogno di altro?' },
          { speaker: 'customer', text: 'No, grazie.' },
        ],
      },
    },
    {
      brandId: BRAND_ID,
      customerId: roberto._id,
      channel: 'whatsapp',
      status: 'blocked',
      type: 'inbound',
      aiActive: false,
      lastActivityAt: daysAgo(9),
    },
    {
      brandId: BRAND_ID,
      customerId: roberto._id,
      channel: 'onsite',
      status: 'ai_controlled',
      type: 'outbound',
      aiActive: true,
      campaign: 'estate-2024',
      lastActivityAt: daysAgo(7),
    },
    {
      brandId: BRAND_ID,
      customerId: chiara._id,
      channel: 'email',
      status: 'to_manage',
      type: 'inbound',
      assigneeId: luca._id,
      aiActive: false,
      lastActivityAt: daysAgo(13),
      channelData: { subject: 'Problema taglia: voglio cambiare il vestito' },
    },
    {
      brandId: BRAND_ID,
      customerId: chiara._id,
      channel: 'email',
      status: 'managed',
      type: 'outbound',
      assigneeId: luca._id,
      aiActive: false,
      campaign: 'newsletter-mag',
      lastActivityAt: daysAgo(11),
      channelData: { subject: 'Offerta esclusiva per te: -20% sui nuovi arrivi' },
    },
    {
      brandId: BRAND_ID,
      customerId: davide._id,
      channel: 'voice',
      status: 'human_controlled',
      type: 'inbound',
      assigneeId: marco._id,
      aiActive: false,
      lastActivityAt: daysAgo(5),
      channelData: {
        duration: '7:15',
        outcome: 'Successful',
        transcript: [
          { speaker: 'ai', text: 'Benvenuto, come posso aiutarla?' },
          { speaker: 'customer', text: 'Ho un problema con il pagamento del mio ordine.' },
          { speaker: 'ai', text: 'Capisco, la metto in contatto con un operatore.' },
          { speaker: 'customer', text: 'Grazie.' },
          { speaker: 'ai', text: 'Rimanga in linea per favore.' },
          { speaker: 'customer', text: "L'operatore ha risolto il problema, grazie." },
          { speaker: 'ai', text: 'Ottimo! Buona giornata.' },
        ],
      },
    },
    {
      brandId: BRAND_ID,
      customerId: davide._id,
      channel: 'email',
      status: 'ai_controlled',
      type: 'inbound',
      aiActive: true,
      lastActivityAt: daysAgo(4),
      channelData: { subject: 'Dove è il mio pacco?' },
    },
    {
      brandId: BRAND_ID,
      customerId: elena._id,
      channel: 'whatsapp',
      status: 'managed',
      type: 'inbound',
      assigneeId: giulia._id,
      aiActive: false,
      lastActivityAt: hoursAgo(5),
    },
    {
      brandId: BRAND_ID,
      customerId: elena._id,
      channel: 'onsite',
      status: 'to_manage',
      type: 'outbound',
      aiActive: false,
      campaign: 'reactivation-q2',
      lastActivityAt: hoursAgo(10),
    },
    {
      brandId: BRAND_ID,
      customerId: elena._id,
      channel: 'email',
      status: 'blocked',
      type: 'inbound',
      aiActive: false,
      lastActivityAt: daysAgo(2),
      channelData: { subject: 'Richiesta fattura ordine #10067' },
    },
  ]);

  // ── messages ─────────────────────────────────────────────────────────────
  // voice conversations (annaVoice, davideVoice) get NO messages

  const msgs: object[] = [
    // annaWa — WhatsApp / to_manage (8 msgs, includes button)
    { conversationId: annaWa._id, sentBy: 'customer', content: 'Ciao, ho ricevuto il pacco ma manca un articolo!', type: 'text', sentAt: hoursAgo(26) },
    { conversationId: annaWa._id, sentBy: 'ai', content: 'Mi dispiace per il disagio. Può indicarmi il numero d\'ordine?', type: 'text', sentAt: hoursAgo(25) },
    { conversationId: annaWa._id, sentBy: 'customer', content: 'È l\'ordine #10021.', type: 'text', sentAt: hoursAgo(24) },
    { conversationId: annaWa._id, sentBy: 'ai', content: 'Verifico subito. Come preferisce procedere?', type: 'button', sentAt: hoursAgo(23) },
    { conversationId: annaWa._id, sentBy: 'customer', content: 'Voglio il rimborso.', type: 'text', sentAt: hoursAgo(22) },
    { conversationId: annaWa._id, sentBy: 'ai', content: 'Ho aperto la pratica di rimborso. Riceverà una conferma via email.', type: 'text', sentAt: hoursAgo(6) },
    { conversationId: annaWa._id, sentBy: 'customer', content: 'Quando arriva il rimborso?', type: 'text', sentAt: hoursAgo(4) },
    { conversationId: annaWa._id, sentBy: 'operator', content: 'Il rimborso sarà elaborato entro 5 giorni lavorativi.', type: 'text', sentAt: hoursAgo(2) },

    // annaEmail — Email / managed (4 msgs, formal, with attachments)
    {
      conversationId: annaEmail._id,
      sentBy: 'customer',
      content:
        "Buongiorno,\n\nvi scrivo per segnalare un problema con l'ordine #10021, consegnato ieri.\n\nAprendo il pacco ho riscontrato che mancava uno degli articoli ordinati: la camicia in lino color sabbia, taglia M. Allego copia della distinta di imballaggio e una foto del contenuto del pacco al momento dell'apertura, in modo che possiate verificare quanto segnalato.\n\nTrattandosi di un capo che mi serviva per un'occasione specifica, vi chiedo cortesemente di procedere con il rimborso piuttosto che con una nuova spedizione.\n\nResto in attesa di un vostro riscontro.\n\nCordiali saluti,\nAnna Conti",
      type: 'text',
      sentAt: daysAgo(5),
      attachments: [
        { filename: 'distinta_imballaggio_10021.pdf', size: 184_320, mimeType: 'application/pdf' },
        { filename: 'foto_pacco_aperto.jpg', size: 2_410_000, mimeType: 'image/jpeg' },
      ],
    },
    {
      conversationId: annaEmail._id,
      sentBy: 'ai',
      content:
        "Gentile Anna,\n\ngrazie per averci contattato e per la tempestività nella segnalazione. Ci dispiace molto per il disagio.\n\nHo aperto una pratica di rimborso con riferimento RIF-2024-0451 e l'ho assegnata al nostro team di assistenza, che sta verificando con il magazzino. Le confermeremo entro 24 ore l'esito della verifica e i tempi di accredito.\n\nA presto,\nAssistenza TextYess",
      type: 'text',
      sentAt: daysAgo(5),
    },
    {
      conversationId: annaEmail._id,
      sentBy: 'operator',
      content:
        "Gentile Anna,\n\nabbiamo completato la verifica sull'ordine #10021 e confermiamo il rimborso di € 89,00 per l'articolo non ricevuto. L'importo verrà accreditato sul metodo di pagamento utilizzato per l'acquisto entro 3-5 giorni lavorativi.\n\nIn allegato trova la nota di credito ufficiale per i suoi archivi.\n\nCome gesto di scuse abbiamo inoltre attivato sul suo account il codice TEXTSCUSE15, che le offre uno sconto del 15% sui prossimi acquisti per i prossimi 60 giorni.\n\nRestiamo a disposizione per qualsiasi necessità.\n\nUn cordiale saluto,\nMarco Rossi\nServizio Clienti TextYess",
      type: 'text',
      sentAt: daysAgo(4),
      attachments: [
        { filename: 'nota_credito_NC-2024-0451.pdf', size: 96_800, mimeType: 'application/pdf' },
      ],
    },
    {
      conversationId: annaEmail._id,
      sentBy: 'customer',
      content:
        "Buongiorno Marco,\n\nvi ringrazio per la risposta puntuale e per il codice sconto, è un gesto molto apprezzato.\n\nConfermo di aver ricevuto la nota di credito. Resto in attesa dell'accredito sul mio conto.\n\nBuona giornata,\nAnna",
      type: 'text',
      sentAt: daysAgo(4),
    },

    // robertoWa — WhatsApp / blocked (5 msgs, includes button)
    { conversationId: robertoWa._id, sentBy: 'customer', content: 'Quanto costa la spedizione?', type: 'text', sentAt: daysAgo(10) },
    { conversationId: robertoWa._id, sentBy: 'ai', content: 'La spedizione standard è gratuita sopra i 50€.', type: 'text', sentAt: daysAgo(10) },
    { conversationId: robertoWa._id, sentBy: 'customer', content: 'Ok, voglio ordinare queste scarpe.', type: 'text', sentAt: daysAgo(10) },
    { conversationId: robertoWa._id, sentBy: 'ai', content: 'Scelga la taglia che preferisce:', type: 'button', sentAt: daysAgo(10) },
    { conversationId: robertoWa._id, sentBy: 'customer', content: 'Taglia 42 per favore.', type: 'text', sentAt: daysAgo(9) },

    // robertoOs — Onsite / ai_controlled (5 msgs)
    { conversationId: robertoOs._id, sentBy: 'ai', content: 'Benvenuto! Hai bisogno di aiuto?', type: 'text', sentAt: daysAgo(8) },
    { conversationId: robertoOs._id, sentBy: 'customer', content: 'Sì, cerco una giacca estiva.', type: 'text', sentAt: daysAgo(8) },
    { conversationId: robertoOs._id, sentBy: 'ai', content: 'Perfetto! Abbiamo nuovi arrivi estate 2024. Preferisci casual o elegante?', type: 'text', sentAt: daysAgo(8) },
    { conversationId: robertoOs._id, sentBy: 'customer', content: 'Casual va benissimo.', type: 'text', sentAt: daysAgo(7) },
    { conversationId: robertoOs._id, sentBy: 'ai', content: 'Ecco i modelli disponibili per te!', type: 'button', sentAt: daysAgo(7) },

    // chiaraEmail — Email / to_manage (3 msgs, formal, with attachments)
    {
      conversationId: chiaraEmail._id,
      sentBy: 'customer',
      content:
        "Salve,\n\nho ricevuto la settimana scorsa l'ordine #10033 (vestito modello \"Estiva\" colore verde, taglia M) ma purtroppo la taglia risulta troppo abbondante sul punto vita.\n\nVorrei cortesemente richiedere il cambio con la taglia S, se ancora disponibile in magazzino. Allego una foto della prova in modo da poter valutare anche voi la vestibilità attuale.\n\nIn attesa di istruzioni sulla procedura di reso, vi ringrazio anticipatamente.\n\nCordialmente,\nChiara Lombardi",
      type: 'text',
      sentAt: daysAgo(14),
      attachments: [
        { filename: 'prova_vestito_estiva.jpg', size: 3_120_000, mimeType: 'image/jpeg' },
      ],
    },
    {
      conversationId: chiaraEmail._id,
      sentBy: 'ai',
      content:
        "Gentile Chiara,\n\ngrazie per averci scritto. Ho verificato la disponibilità: la taglia S del modello \"Estiva\" verde è ancora a magazzino, quindi possiamo procedere con il cambio.\n\nIn allegato trova l'etichetta di reso prepagata BRT da applicare al pacco originale: può consegnarlo in qualsiasi punto Bartolini entro 14 giorni. Appena riceveremo il capo, spediremo la nuova taglia (tempi previsti 2-3 giorni lavorativi).\n\nLe inoltro anche la procedura dettagliata in PDF con tutti i passaggi e i nostri riferimenti.\n\nResto a disposizione per qualsiasi domanda,\nAssistenza TextYess",
      type: 'text',
      sentAt: daysAgo(13),
      attachments: [
        { filename: 'etichetta_reso_BRT_10033.pdf', size: 142_500, mimeType: 'application/pdf' },
        { filename: 'procedura_cambio_taglia.pdf', size: 218_400, mimeType: 'application/pdf' },
      ],
    },
    {
      conversationId: chiaraEmail._id,
      sentBy: 'customer',
      content:
        "Grazie mille per la rapidità e per le istruzioni dettagliate.\n\nHo già stampato l'etichetta, provvederò alla spedizione entro questa settimana.\n\nBuona giornata,\nChiara",
      type: 'text',
      sentAt: daysAgo(13),
    },

    // chiaraEmailOut — Email outbound / managed (3 msgs, formal, with attachment)
    {
      conversationId: chiaraEmailOut._id,
      sentBy: 'operator',
      content:
        "Ciao Chiara,\n\nin qualità di nostra cliente abbonata abbiamo selezionato per te un'anteprima della nuova collezione Primavera/Estate 2024, con un codice sconto personale del 20% valido fino al 31 maggio.\n\nIn allegato trovi il catalogo PDF con tutti i nuovi arrivi e, nell'ultima pagina, il tuo codice promozionale (PE24-CHIARA-20) e le istruzioni per applicarlo in fase di checkout.\n\nSe hai bisogno di consigli su taglie o tessuti, rispondi a questa email: il nostro team è felice di aiutarti.\n\nBuono shopping!\nIl team TextYess",
      type: 'text',
      sentAt: daysAgo(12),
      attachments: [
        { filename: 'catalogo_PE_2024.pdf', size: 4_820_000, mimeType: 'application/pdf' },
      ],
    },
    {
      conversationId: chiaraEmailOut._id,
      sentBy: 'customer',
      content:
        "Buongiorno,\n\ngrazie mille per il catalogo. Ho dato un'occhiata e ci sono diversi capi che mi piacciono molto, in particolare i due abiti della linea sostenibile.\n\nApprofitterò sicuramente dell'offerta nei prossimi giorni.\n\nBuona giornata,\nChiara",
      type: 'text',
      sentAt: daysAgo(11),
    },
    {
      conversationId: chiaraEmailOut._id,
      sentBy: 'operator',
      content:
        "Cara Chiara,\n\nci fa molto piacere! Ti confermiamo che il codice PE24-CHIARA-20 è valido anche sui capi della linea sostenibile e si cumula con la spedizione gratuita sopra i 50€.\n\nRestiamo a disposizione per qualsiasi consiglio.\n\nA presto,\nIl team TextYess",
      type: 'text',
      sentAt: daysAgo(11),
    },

    // davideEmail — Email / ai_controlled (3 msgs, formal, with attachment)
    {
      conversationId: davideEmail._id,
      sentBy: 'customer',
      content:
        "Buongiorno,\n\nho effettuato un ordine quattro giorni fa (purtroppo al momento non riesco a recuperare il numero esatto dalla mail di conferma) e da allora non ho più ricevuto aggiornamenti sullo stato della spedizione.\n\nIl link di tracking che mi avete inviato restituisce un errore generico (\"Spedizione non trovata\"). Vi chiedo cortesemente di verificare lo stato e di fornirmi un nuovo riferimento.\n\nGrazie,\nDavide Russo",
      type: 'text',
      sentAt: daysAgo(5),
    },
    {
      conversationId: davideEmail._id,
      sentBy: 'ai',
      content:
        "Gentile Davide,\n\nho recuperato il suo ordine dal nostro sistema utilizzando l'indirizzo email associato: si tratta dell'ordine #10056.\n\nLa spedizione è stata presa in carico dal corriere BRT in data 10/05. Il nuovo numero di tracking è TX9823456IT e la consegna è prevista per la giornata di domani entro le ore 18:00.\n\nIn allegato trova il riepilogo completo della spedizione con il link diretto al portale del corriere.\n\nLa preghiamo di scusarci per il disagio causato dal link precedente.\n\nCordiali saluti,\nAssistenza TextYess",
      type: 'text',
      sentAt: daysAgo(5),
      attachments: [
        { filename: 'riepilogo_spedizione_10056.pdf', size: 124_700, mimeType: 'application/pdf' },
      ],
    },
    {
      conversationId: davideEmail._id,
      sentBy: 'customer',
      content:
        "Buongiorno,\n\nora il tracking funziona correttamente e vedo che il pacco è in transito. Vi ringrazio per la rapidità della risposta.\n\nResto in attesa della consegna.\n\nCordiali saluti,\nDavide",
      type: 'text',
      sentAt: daysAgo(4),
    },

    // elenaWa — WhatsApp / managed (6 msgs, includes button)
    { conversationId: elenaWa._id, sentBy: 'customer', content: 'Ciao! Ho visto la borsa nuova sul sito, è disponibile in nero?', type: 'text', sentAt: hoursAgo(18) },
    { conversationId: elenaWa._id, sentBy: 'ai', content: 'Ciao Elena! Sì, la borsa è disponibile in nero, bordeaux e cognac.', type: 'text', sentAt: hoursAgo(17) },
    { conversationId: elenaWa._id, sentBy: 'customer', content: 'Fantastica! La prendo in nero. Come faccio l\'ordine?', type: 'text', sentAt: hoursAgo(16) },
    { conversationId: elenaWa._id, sentBy: 'ai', content: 'Clicca qui per aggiungerla al carrello:', type: 'button', sentAt: hoursAgo(15) },
    { conversationId: elenaWa._id, sentBy: 'customer', content: 'Fatto! Ho completato l\'ordine.', type: 'text', sentAt: hoursAgo(8) },
    { conversationId: elenaWa._id, sentBy: 'operator', content: 'Perfetto Elena! Il tuo ordine #10067 è confermato. Spediremo entro 24h!', type: 'text', sentAt: hoursAgo(5) },

    // elenaOs — Onsite / to_manage (6 msgs)
    { conversationId: elenaOs._id, sentBy: 'ai', content: 'Ciao Elena, bentornata! Posso aiutarti?', type: 'text', sentAt: hoursAgo(22) },
    { conversationId: elenaOs._id, sentBy: 'customer', content: 'Sì, cerco qualcosa per un evento formale.', type: 'text', sentAt: hoursAgo(21) },
    { conversationId: elenaOs._id, sentBy: 'ai', content: 'Ho selezionato per te i nostri abiti da sera. Vuoi vedere?', type: 'text', sentAt: hoursAgo(20) },
    { conversationId: elenaOs._id, sentBy: 'customer', content: 'Sì, mostrami le opzioni.', type: 'text', sentAt: hoursAgo(19) },
    { conversationId: elenaOs._id, sentBy: 'ai', content: 'Ecco la nostra selezione esclusiva!', type: 'button', sentAt: hoursAgo(18) },
    { conversationId: elenaOs._id, sentBy: 'customer', content: 'Interessante, ma ho bisogno di parlare con qualcuno.', type: 'text', sentAt: hoursAgo(10) },

    // elenaEmail — Email / blocked (4 msgs, formal, customer-uploaded attachment)
    {
      conversationId: elenaEmail._id,
      sentBy: 'customer',
      content:
        "Buonasera,\n\nho effettuato l'ordine #10067 in data 13/05 e necessito della fattura elettronica per la mia rendicontazione mensile.\n\nVi prego di emetterla intestata ai dati riportati nel modulo allegato (codice fiscale e PEC inclusi), e di farmela pervenire al più presto.\n\nIn attesa di un vostro riscontro, porgo cordiali saluti,\nElena Martinelli",
      type: 'text',
      sentAt: daysAgo(3),
      attachments: [
        { filename: 'dati_fatturazione_martinelli.pdf', size: 78_200, mimeType: 'application/pdf' },
      ],
    },
    {
      conversationId: elenaEmail._id,
      sentBy: 'ai',
      content:
        "Gentile Elena,\n\ngrazie per averci contattato. La fattura elettronica per l'ordine #10067 verrà generata automaticamente entro 24 ore dalla spedizione e sarà disponibile nella sua area clienti, nella sezione \"Documenti\".\n\nIn caso di mancata ricezione entro 48 ore dall'invio dell'ordine, la invitiamo a contattarci nuovamente per una verifica manuale.\n\nCordiali saluti,\nAssistenza TextYess",
      type: 'text',
      sentAt: daysAgo(3),
    },
    {
      conversationId: elenaEmail._id,
      sentBy: 'customer',
      content:
        "Buongiorno,\n\nho appena controllato l'area clienti ma la sezione \"Documenti\" risulta ancora vuota: sono ormai trascorse 48 ore dall'effettuazione dell'ordine.\n\nIl documento mi serve per il mio commercialista entro la fine della settimana. Vi prego di intervenire manualmente e di fornirmi un riscontro al più presto.\n\nCordiali saluti,\nElena Martinelli",
      type: 'text',
      sentAt: daysAgo(2),
    },
    {
      conversationId: elenaEmail._id,
      sentBy: 'customer',
      content:
        "Buongiorno,\n\nattendo ancora una vostra risposta. Inizio a essere preoccupata: se per voi è più semplice, posso essere contattata anche telefonicamente al numero +39 320 4443322.\n\nResto in attesa,\nElena",
      type: 'text',
      sentAt: daysAgo(2),
    },
  ];

  await Message.insertMany(msgs);

  // ── denormalize lastActivityAt on customers ───────────────────────────────
  const allConvs = [
    annaWa, annaEmail, annaVoice,
    robertoWa, robertoOs,
    chiaraEmail, chiaraEmailOut,
    davideVoice, davideEmail,
    elenaWa, elenaOs, elenaEmail,
  ];

  for (const customer of [anna, roberto, chiara, davide, elena]) {
    const customerConvIds = allConvs
      .filter((c) => c.customerId.toString() === customer._id.toString())
      .map((c) => c._id);

    const lastMsg = await Message.findOne({ conversationId: { $in: customerConvIds } })
      .sort({ sentAt: -1 })
      .lean();

    if (lastMsg) {
      await Customer.updateOne({ _id: customer._id }, { lastActivityAt: lastMsg.sentAt });
    }
  }
}

// ── entrypoint ───────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/textyess';
  const conn = await mongoose.createConnection(uri).asPromise();
  try {
    await runSeed(conn);
    console.log('Seed completed successfully.');
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
