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

const messageSchema = new Schema(
  {
    conversationId: Schema.Types.ObjectId,
    sentBy: String,
    content: String,
    type: { type: String, default: 'text' },
    sentAt: Date,
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
      assigneeId: giulia._id,
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
      assigneeId: sofia._id,
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

    // annaEmail — Email / managed (6 msgs)
    { conversationId: annaEmail._id, sentBy: 'customer', content: 'Buongiorno, vorrei richiedere il rimborso per l\'ordine #10021.', type: 'text', sentAt: daysAgo(5) },
    { conversationId: annaEmail._id, sentBy: 'ai', content: 'Gentile Anna, grazie per averci contattato. Ho preso in carico la sua richiesta.', type: 'text', sentAt: daysAgo(5) },
    { conversationId: annaEmail._id, sentBy: 'operator', content: 'Abbiamo verificato l\'ordine e il rimborso è stato approvato.', type: 'text', sentAt: daysAgo(4) },
    { conversationId: annaEmail._id, sentBy: 'customer', content: 'Grazie mille per la risposta rapida!', type: 'text', sentAt: daysAgo(4) },
    { conversationId: annaEmail._id, sentBy: 'operator', content: 'Riceverà l\'accredito entro 3-5 giorni lavorativi.', type: 'text', sentAt: daysAgo(4) },
    { conversationId: annaEmail._id, sentBy: 'customer', content: 'Perfetto. Grazie.', type: 'text', sentAt: daysAgo(4) },

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

    // chiaraEmail — Email / to_manage (7 msgs)
    { conversationId: chiaraEmail._id, sentBy: 'customer', content: 'Salve, ho ordinato una taglia M ma è troppo grande. Posso cambiarla con una S?', type: 'text', sentAt: daysAgo(14) },
    { conversationId: chiaraEmail._id, sentBy: 'ai', content: 'Buongiorno Chiara, capisco il problema. Può inviarmi il numero d\'ordine?', type: 'text', sentAt: daysAgo(14) },
    { conversationId: chiaraEmail._id, sentBy: 'customer', content: 'Certo, è l\'ordine #10033.', type: 'text', sentAt: daysAgo(13) },
    { conversationId: chiaraEmail._id, sentBy: 'ai', content: 'Ho trovato l\'ordine. Il cambio taglia è possibile entro 30 giorni dall\'acquisto.', type: 'text', sentAt: daysAgo(13) },
    { conversationId: chiaraEmail._id, sentBy: 'customer', content: 'Come devo procedere?', type: 'text', sentAt: daysAgo(13) },
    { conversationId: chiaraEmail._id, sentBy: 'ai', content: 'Le invio le istruzioni per la restituzione e il nuovo ordine.', type: 'text', sentAt: daysAgo(13) },
    { conversationId: chiaraEmail._id, sentBy: 'customer', content: 'Grazie, aspetto le istruzioni.', type: 'text', sentAt: daysAgo(13) },

    // chiaraEmailOut — Email outbound / managed (5 msgs)
    { conversationId: chiaraEmailOut._id, sentBy: 'operator', content: 'Cara Chiara, ti scriviamo con un\'offerta speciale: -20% su tutti i nuovi arrivi.', type: 'text', sentAt: daysAgo(12) },
    { conversationId: chiaraEmailOut._id, sentBy: 'customer', content: 'Oh grazie! Che belle novità questa stagione.', type: 'text', sentAt: daysAgo(12) },
    { conversationId: chiaraEmailOut._id, sentBy: 'operator', content: 'Esatto! La promozione è valida fino al 31 maggio.', type: 'text', sentAt: daysAgo(11) },
    { conversationId: chiaraEmailOut._id, sentBy: 'customer', content: 'Approfitterò sicuramente dell\'offerta.', type: 'text', sentAt: daysAgo(11) },
    { conversationId: chiaraEmailOut._id, sentBy: 'operator', content: 'Ottimo! Ti aspettiamo. Buona giornata!', type: 'text', sentAt: daysAgo(11) },

    // davideEmail — Email / ai_controlled (6 msgs)
    { conversationId: davideEmail._id, sentBy: 'customer', content: 'Buongiorno, non riesco a tracciare il mio pacco.', type: 'text', sentAt: daysAgo(5) },
    { conversationId: davideEmail._id, sentBy: 'ai', content: 'Salve Davide, le invio subito il link di tracciamento.', type: 'text', sentAt: daysAgo(5) },
    { conversationId: davideEmail._id, sentBy: 'customer', content: 'Il link non funziona.', type: 'text', sentAt: daysAgo(5) },
    { conversationId: davideEmail._id, sentBy: 'ai', content: 'Mi scusi per il disagio. Il numero di tracciamento è TX9823456IT.', type: 'text', sentAt: daysAgo(5) },
    { conversationId: davideEmail._id, sentBy: 'customer', content: 'Grazie, ora funziona. Il pacco è in transito.', type: 'text', sentAt: daysAgo(4) },
    { conversationId: davideEmail._id, sentBy: 'ai', content: 'Perfetto! Dovrebbe arrivare entro domani. Buona giornata!', type: 'text', sentAt: daysAgo(4) },

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

    // elenaEmail — Email / blocked (4 msgs)
    { conversationId: elenaEmail._id, sentBy: 'customer', content: 'Buonasera, ho bisogno della fattura per l\'ordine #10067.', type: 'text', sentAt: daysAgo(3) },
    { conversationId: elenaEmail._id, sentBy: 'ai', content: 'Gentile Elena, la fattura sarà disponibile nell\'area clienti entro 24h.', type: 'text', sentAt: daysAgo(3) },
    { conversationId: elenaEmail._id, sentBy: 'customer', content: 'Ho controllato ma non la trovo. Mi può aiutare?', type: 'text', sentAt: daysAgo(2) },
    { conversationId: elenaEmail._id, sentBy: 'customer', content: 'Aspetto ancora risposta...', type: 'text', sentAt: daysAgo(2) },
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
