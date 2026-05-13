export type Channel = "whatsapp" | "email" | "voice" | "onsite";
export type Status =
  | "ai_controlled"
  | "to_manage"
  | "managed"
  | "blocked"
  | "human_controlled";
export type SentBy = "customer" | "ai" | "operator";

export interface Message {
  id: string;
  conversationId: string;
  sentBy: SentBy;
  content: string;
  sentAt: string;
}

export interface TranscriptLine {
  speaker: "ai" | "customer";
  text: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  channel: Channel;
  status: Status;
  type: "inbound" | "outbound";
  assigneeId: string | null;
  aiActive: boolean;
  campaign: string | null;
  lastActivityAt: string;
  channelData: {
    subject?: string;
    duration?: string;
    outcome?: "Successful" | "No answer" | "Failed";
    transcript?: TranscriptLine[];
  };
  messages: Message[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  lifetimeSpend: number;
  tags: string[];
  notes: string;
  createdAt: string;
  lastActivityAt: string;
  urgencyStatus: Status;
  lastOrder: { id: string; placedAt: string; amount: number } | null;
  conversations: Conversation[];
}

export interface Operator {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
}

const now = Date.now();
const mins = (n: number) => new Date(now - n * 60_000).toISOString();
const hours = (n: number) => new Date(now - n * 3_600_000).toISOString();
const days = (n: number) => new Date(now - n * 86_400_000).toISOString();

export const OPERATORS: Operator[] = [
  { id: "op1", name: "Giulia Moretti", email: "giulia@textyess.com", initials: "GM", color: "bg-primary-200 text-primary-800" },
  { id: "op2", name: "Roberto Gallo", email: "roberto@textyess.com", initials: "RG", color: "bg-success-100 text-success-700" },
  { id: "op3", name: "Chiara Vitale", email: "chiara@textyess.com", initials: "CV", color: "bg-warning-100 text-warning-700" },
];

export const CUSTOMERS: Customer[] = [
  // ─────────────────────────────────────────────────────────
  // Marco Bianchi — WhatsApp (to_manage) + Email + Voice
  // ─────────────────────────────────────────────────────────
  {
    id: "c1",
    name: "Marco Bianchi",
    email: "marco.bianchi@gmail.com",
    phone: "+39 333 982 1547",
    lifetimeSpend: 2300,
    tags: ["VIP", "Repeat buyer"],
    notes: "Interested in olive oil line. Has placed 12 orders.",
    createdAt: days(120),
    lastActivityAt: mins(2),
    urgencyStatus: "to_manage",
    lastOrder: { id: "#1052", placedAt: days(26), amount: 42 },
    conversations: [
      {
        id: "conv1",
        customerId: "c1",
        channel: "whatsapp",
        status: "to_manage",
        type: "inbound",
        assigneeId: "op1",
        aiActive: false,
        campaign: null,
        lastActivityAt: mins(2),
        channelData: {},
        messages: [
          { id: "m1", conversationId: "conv1", sentBy: "customer", content: "Ciao! Vorrei acquistare dell'olio. Avete l'Olio Detergente Struccante in stock?", sentAt: mins(12) },
          { id: "m2", conversationId: "conv1", sentBy: "ai", content: "Ciao Marco! Certo, l'Olio Detergente Struccante è disponibile a €23. Si trasforma in latte a contatto con l'acqua, rimuovendo anche il make-up waterproof. Vuoi procedere?", sentAt: mins(11) },
          { id: "m3", conversationId: "conv1", sentBy: "customer", content: "Perfetto! Quanti ne posso ordinare?", sentAt: mins(2) },
        ],
      },
      {
        id: "conv2",
        customerId: "c1",
        channel: "email",
        status: "ai_controlled",
        type: "outbound",
        assigneeId: "op1",
        aiActive: true,
        campaign: "Summer Sale",
        lastActivityAt: hours(3),
        channelData: { subject: "La tua offerta esclusiva — Summer Sale 🌞" },
        messages: [
          { id: "m4", conversationId: "conv2", sentBy: "ai", content: "Ciao Marco, in occasione della nostra Summer Sale abbiamo pensato a te! Usa il codice SUMMER20 per un 20% di sconto sul prossimo ordine. Offerta valida fino al 30 giugno.", sentAt: days(1) },
          { id: "m5", conversationId: "conv2", sentBy: "customer", content: "Ottimo! Lo userò subito, grazie 🙏", sentAt: hours(3) },
        ],
      },
      {
        id: "conv3",
        customerId: "c1",
        channel: "voice",
        status: "managed",
        type: "inbound",
        assigneeId: null,
        aiActive: true,
        campaign: null,
        lastActivityAt: days(2),
        channelData: {
          duration: "3:12",
          outcome: "Successful",
          transcript: [
            { speaker: "ai", text: "Ciao, sono Sara, l'assistente di Schermo. Come posso aiutarla?" },
            { speaker: "customer", text: "Sì, ciao, volevo chiederti del mio ordine #1052." },
            { speaker: "ai", text: "Certo! L'ordine #1052 è stato spedito ieri e arriverà entro 2–3 giorni lavorativi." },
            { speaker: "customer", text: "Perfetto, grazie mille!" },
          ],
        },
        messages: [],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // Sofia Conti — WhatsApp (ai_controlled) + OnSite
  // ─────────────────────────────────────────────────────────
  {
    id: "c2",
    name: "Sofia Conti",
    email: "sofia.conti@outlook.com",
    phone: "+39 347 661 2234",
    lifetimeSpend: 890,
    tags: ["New customer"],
    notes: "First purchase. Discovered via Instagram campaign.",
    createdAt: days(54),
    lastActivityAt: mins(45),
    urgencyStatus: "ai_controlled",
    lastOrder: { id: "#1089", placedAt: days(3), amount: 89 },
    conversations: [
      {
        id: "conv4",
        customerId: "c2",
        channel: "whatsapp",
        status: "ai_controlled",
        type: "inbound",
        assigneeId: "op2",
        aiActive: true,
        campaign: null,
        lastActivityAt: mins(45),
        channelData: {},
        messages: [
          { id: "m8", conversationId: "conv4", sentBy: "ai", content: "Ciao Sofia! Ho notato che hai lasciato la Crema Viso SPF50 nel carrello 🛒 Posso aiutarti a completare l'acquisto?", sentAt: hours(2) },
          { id: "m9", conversationId: "conv4", sentBy: "customer", content: "Sì! Posso avere un codice sconto?", sentAt: mins(45) },
        ],
      },
      {
        id: "conv5",
        customerId: "c2",
        channel: "onsite",
        status: "ai_controlled",
        type: "inbound",
        assigneeId: null,
        aiActive: true,
        campaign: null,
        lastActivityAt: days(3),
        channelData: {},
        messages: [
          { id: "m11", conversationId: "conv5", sentBy: "customer", content: "Quali sono i tempi di spedizione?", sentAt: days(3) },
          { id: "m12", conversationId: "conv5", sentBy: "ai", content: "Consegniamo in 2–3 giorni lavorativi in tutta Italia, con spedizione gratuita per ordini superiori a €50.", sentAt: days(3) },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // Luca Ferrara — Email (to_manage, AI off)
  // ─────────────────────────────────────────────────────────
  {
    id: "c3",
    name: "Luca Ferrara",
    email: "luca.ferrara@libero.it",
    phone: "+39 366 234 8890",
    lifetimeSpend: 450,
    tags: ["B2B", "Wholesale"],
    notes: "Runs a beauty salon. Interested in wholesale pricing.",
    createdAt: days(200),
    lastActivityAt: hours(3),
    urgencyStatus: "to_manage",
    lastOrder: null,
    conversations: [
      {
        id: "conv6",
        customerId: "c3",
        channel: "email",
        status: "to_manage",
        type: "inbound",
        assigneeId: "op3",
        aiActive: false,
        campaign: "B2B Outreach",
        lastActivityAt: hours(3),
        channelData: { subject: "Richiesta preventivo — acquisto all'ingrosso" },
        messages: [
          { id: "m13", conversationId: "conv6", sentBy: "customer", content: "Buongiorno, gestisco un salone di bellezza e vorrei capire se avete prezzi all'ingrosso per ordini ricorrenti. Siamo interessati alla linea viso.", sentAt: hours(5) },
          { id: "m14", conversationId: "conv6", sentBy: "ai", content: "Buongiorno Luca! Abbiamo un programma di partnership per saloni professionali. Le invio i dettagli del nostro catalogo wholesale.", sentAt: hours(4) },
          { id: "m15", conversationId: "conv6", sentBy: "customer", content: "Grazie, ma ho bisogno di parlare con un operatore per discutere i prezzi.", sentAt: hours(3) },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // Emma Russo — Voice (managed) + WhatsApp (managed)
  // ─────────────────────────────────────────────────────────
  {
    id: "c4",
    name: "Emma Russo",
    email: "emma.russo@gmail.com",
    phone: "+39 392 718 5566",
    lifetimeSpend: 1750,
    tags: ["Loyal", "Subscriber"],
    notes: "Monthly subscriber. Prefers voice communication.",
    createdAt: days(540),
    lastActivityAt: days(1),
    urgencyStatus: "managed",
    lastOrder: { id: "#1041", placedAt: days(12), amount: 125 },
    conversations: [
      {
        id: "conv7",
        customerId: "c4",
        channel: "voice",
        status: "managed",
        type: "inbound",
        assigneeId: null,
        aiActive: true,
        campaign: null,
        lastActivityAt: days(1),
        channelData: {
          duration: "5:47",
          outcome: "Successful",
          transcript: [
            { speaker: "ai", text: "Ciao Emma! Come posso aiutarti oggi?" },
            { speaker: "customer", text: "Volevo rinnovare il mio abbonamento mensile e aggiungere il siero vitamina C." },
            { speaker: "ai", text: "Perfetto! Ho rinnovato l'abbonamento e aggiunto il Siero Vitamina C. Totale mensile: €125. Riceverà conferma via email." },
            { speaker: "customer", text: "Grazie mille, come sempre tutto perfetto!" },
          ],
        },
        messages: [],
      },
      {
        id: "conv8",
        customerId: "c4",
        channel: "whatsapp",
        status: "managed",
        type: "inbound",
        assigneeId: "op2",
        aiActive: false,
        campaign: null,
        lastActivityAt: days(3),
        channelData: {},
        messages: [
          { id: "m16", conversationId: "conv8", sentBy: "customer", content: "Il mio ordine è arrivato! Tutto perfetto, grazie 😊", sentAt: days(3) },
          { id: "m17", conversationId: "conv8", sentBy: "operator", content: "Che bello sentire questo, Emma! Grazie per la fiducia 💜", sentAt: days(3) },
        ],
      },
    ],
  },
];
