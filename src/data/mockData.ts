export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalRevenue: number;
}

export interface Quotation {
  id: string;
  customerId: string;
  customerName: string;
  items: string;
  totalAmount: number;
  status: "draft" | "sent" | "approved" | "rejected";
  createdAt: string;
  validUntil: string;
}

export interface ProductVariation {
  id: string;
  productType: string;
  variation: string;
  material: string;
  size: string;
  color: string;
  print: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

export interface StatusHistoryEntry {
  status: "pending" | "in_production" | "delivered";
  timestamp: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  quotationId?: string;
  items: string;
  quantity: number;
  totalCost: number;
  revenue: number;
  margin: number;
  status: "pending" | "in_production" | "delivered";
  productionStage: string;
  dueDate: string;
  createdAt: string;
  paymentStatus: "si" | "no";
  paymentReceipt?: string;
  productVariations: ProductVariation[];
  statusHistory: StatusHistoryEntry[];
}

export interface StageHistoryEntry {
  stage: "design" | "cutting" | "sewing" | "embroidery" | "quality" | "printing" | "dispatch";
  enteredAt: string;
}

export interface ProductionOrder {
  id: string;
  orderId: string;
  customerName: string;
  items: string;
  quantity: number;
  stage: "design" | "cutting" | "sewing" | "embroidery" | "quality" | "printing" | "dispatch";
  assignee: string;
  dueDate: string;
  daysInStage: number;
  isDelayed: boolean;
  stageHistory: StageHistoryEntry[];
}

export const customers: Customer[] = [
  { id: "c1", name: "María García", company: "Uniformes del Norte", email: "maria@uniformesnorte.com", phone: "+52 81 1234 5678", totalOrders: 12, totalRevenue: 245000 },
  { id: "c2", name: "Carlos López", company: "Textiles Monterrey", email: "carlos@texmty.com", phone: "+52 81 9876 5432", totalOrders: 8, totalRevenue: 180000 },
  { id: "c3", name: "Ana Martínez", company: "Escuelas Unidas SA", email: "ana@escuelasunidas.mx", phone: "+52 55 4567 8901", totalOrders: 15, totalRevenue: 320000 },
  { id: "c4", name: "Roberto Hernández", company: "Hotel Riviera", email: "roberto@hotelriviera.com", phone: "+52 998 234 5678", totalOrders: 5, totalRevenue: 95000 },
  { id: "c5", name: "Laura Sánchez", company: "Clínica Salud Plus", email: "laura@saludplus.mx", phone: "+52 33 6789 0123", totalOrders: 9, totalRevenue: 210000 },
];

export const quotations: Quotation[] = [
  { id: "Q-001", customerId: "c1", customerName: "Uniformes del Norte", items: "500 Polos corporativos", totalAmount: 85000, status: "approved", createdAt: "2026-03-28", validUntil: "2026-04-28" },
  { id: "Q-002", customerId: "c3", customerName: "Escuelas Unidas SA", items: "1200 Uniformes escolares", totalAmount: 156000, status: "sent", createdAt: "2026-04-01", validUntil: "2026-05-01" },
  { id: "Q-003", customerId: "c4", customerName: "Hotel Riviera", items: "200 Uniformes de servicio", totalAmount: 48000, status: "draft", createdAt: "2026-04-05", validUntil: "2026-05-05" },
  { id: "Q-004", customerId: "c2", customerName: "Textiles Monterrey", items: "800 Camisas industriales", totalAmount: 112000, status: "rejected", createdAt: "2026-03-15", validUntil: "2026-04-15" },
  { id: "Q-005", customerId: "c5", customerName: "Clínica Salud Plus", items: "300 Batas médicas", totalAmount: 67500, status: "approved", createdAt: "2026-04-02", validUntil: "2026-05-02" },
];

export const orders: Order[] = [
  { id: "ORD-001", customerId: "c1", customerName: "Uniformes del Norte", quotationId: "Q-001", items: "500 Polos corporativos", quantity: 500, totalCost: 62000, revenue: 85000, margin: 27.1, status: "in_production", productionStage: "Sewing", dueDate: "2026-04-20", createdAt: "2026-03-30", paymentStatus: "si", paymentReceipt: "comprobante_ord001.pdf", statusHistory: [
    { status: "pending", timestamp: "2026-03-30T09:00:00" },
    { status: "in_production", timestamp: "2026-04-02T14:30:00" },
  ], productVariations: [
    { id: "pv1", productType: "Polo", variation: "Polo manga corta cuello redondo", material: "Algodón piqué 220g", size: "S", color: "Azul marino", print: "Bordado logo frontal", quantity: 150, unitCost: 124 },
    { id: "pv2", productType: "Polo", variation: "Polo manga corta cuello redondo", material: "Algodón piqué 220g", size: "M", color: "Azul marino", print: "Bordado logo frontal", quantity: 200, unitCost: 124 },
    { id: "pv3", productType: "Polo", variation: "Polo manga corta cuello V", material: "Algodón piqué 220g", size: "L", color: "Blanco", print: "Serigrafía espalda", quantity: 150, unitCost: 124 },
  ]},
  { id: "ORD-002", customerId: "c3", customerName: "Escuelas Unidas SA", items: "800 Uniformes escolares (fase 1)", quantity: 800, totalCost: 78000, revenue: 104000, margin: 25.0, status: "in_production", productionStage: "Cutting", dueDate: "2026-04-25", createdAt: "2026-03-20", paymentStatus: "no", statusHistory: [
    { status: "pending", timestamp: "2026-03-20T10:15:00" },
    { status: "in_production", timestamp: "2026-03-25T08:00:00" },
  ], productVariations: [
    { id: "pv4", productType: "Camisa escolar", variation: "Camisa manga larga con bolsillo", material: "Popelina 65/35", size: "8", color: "Blanco", print: "Escudo bordado", quantity: 400, unitCost: 97.5 },
    { id: "pv5", productType: "Pantalón escolar", variation: "Pantalón recto clásico", material: "Gabardina stretch", size: "8-10", color: "Azul oscuro", print: "Sin estampado", quantity: 400, unitCost: 97.5 },
  ]},
  { id: "ORD-003", customerId: "c5", customerName: "Clínica Salud Plus", items: "300 Batas médicas", quantity: 300, totalCost: 45000, revenue: 67500, margin: 33.3, status: "pending", productionStage: "Design", dueDate: "2026-04-30", createdAt: "2026-04-03", paymentStatus: "si", paymentReceipt: "comprobante_ord003.pdf", statusHistory: [
    { status: "pending", timestamp: "2026-04-03T11:00:00" },
  ], productVariations: [
    { id: "pv6", productType: "Bata médica", variation: "Bata manga larga con botones", material: "Antifluido 100% poliéster", size: "M", color: "Blanco", print: "Bordado nombre doctor", quantity: 150, unitCost: 150 },
    { id: "pv7", productType: "Bata médica", variation: "Bata manga larga con cierre", material: "Antifluido 100% poliéster", size: "L", color: "Azul cielo", print: "Logo clínica bordado", quantity: 150, unitCost: 150 },
  ]},
  { id: "ORD-004", customerId: "c2", customerName: "Textiles Monterrey", items: "400 Chalecos de seguridad", quantity: 400, totalCost: 38000, revenue: 52000, margin: 26.9, status: "in_production", productionStage: "Quality", dueDate: "2026-04-10", createdAt: "2026-03-10", paymentStatus: "no", statusHistory: [
    { status: "pending", timestamp: "2026-03-10T09:30:00" },
    { status: "in_production", timestamp: "2026-03-15T16:00:00" },
  ], productVariations: [
    { id: "pv8", productType: "Chaleco", variation: "Chaleco reflectante tipo ingeniero", material: "Mesh poliéster + cintas 3M", size: "Unitalla", color: "Naranja fluorescente", print: "Serigrafía nombre empresa", quantity: 250, unitCost: 95 },
    { id: "pv9", productType: "Chaleco", variation: "Chaleco reflectante básico", material: "Mesh poliéster + cintas reflectantes", size: "Unitalla", color: "Amarillo fluorescente", print: "Sin estampado", quantity: 150, unitCost: 95 },
  ]},
  { id: "ORD-005", customerId: "c4", customerName: "Hotel Riviera", items: "150 Uniformes recepción", quantity: 150, totalCost: 28000, revenue: 37500, margin: 25.3, status: "delivered", productionStage: "Dispatch", dueDate: "2026-04-05", createdAt: "2026-03-01", paymentStatus: "si", paymentReceipt: "comprobante_ord005.pdf", statusHistory: [
    { status: "pending", timestamp: "2026-03-01T08:00:00" },
    { status: "in_production", timestamp: "2026-03-05T10:00:00" },
    { status: "delivered", timestamp: "2026-04-04T15:45:00" },
  ], productVariations: [
    { id: "pv10", productType: "Blazer", variation: "Blazer entallado dos botones", material: "Casimir premium", size: "S-M-L", color: "Negro", print: "Pin metálico hotel", quantity: 75, unitCost: 186.67 },
    { id: "pv11", productType: "Camisa", variation: "Camisa slim fit manga larga", material: "Algodón egipcio 120s", size: "S-M-L", color: "Blanco", print: "Bordado discreto cuello", quantity: 75, unitCost: 186.67 },
  ]},
  { id: "ORD-006", customerId: "c1", customerName: "Uniformes del Norte", items: "200 Pantalones cargo", quantity: 200, totalCost: 32000, revenue: 44000, margin: 27.3, status: "in_production", productionStage: "Embroidery", dueDate: "2026-04-15", createdAt: "2026-03-25", paymentStatus: "no", statusHistory: [
    { status: "pending", timestamp: "2026-03-25T09:00:00" },
    { status: "in_production", timestamp: "2026-03-28T11:30:00" },
  ], productVariations: [
    { id: "pv12", productType: "Pantalón", variation: "Pantalón cargo reforzado", material: "Drill 100% algodón 14oz", size: "30-32", color: "Caqui", print: "Bordado logo pierna", quantity: 120, unitCost: 160 },
    { id: "pv13", productType: "Pantalón", variation: "Pantalón cargo estándar", material: "Drill 100% algodón 12oz", size: "34-36", color: "Negro", print: "Sin estampado", quantity: 80, unitCost: 160 },
  ]},
];

export const productionOrders: ProductionOrder[] = [
  { id: "PO-001", orderId: "ORD-003", customerName: "Clínica Salud Plus", items: "300 Batas médicas", quantity: 300, stage: "design", assignee: "Diego R.", dueDate: "2026-04-30", daysInStage: 2, isDelayed: false, stageHistory: [{ stage: "design", enteredAt: "2026-04-08T09:00:00" }] },
  { id: "PO-002", orderId: "ORD-002", customerName: "Escuelas Unidas SA", items: "800 Uniformes escolares", quantity: 800, stage: "cutting", assignee: "Patricia M.", dueDate: "2026-04-25", daysInStage: 3, isDelayed: false, stageHistory: [{ stage: "design", enteredAt: "2026-03-25T08:00:00" }, { stage: "cutting", enteredAt: "2026-03-28T10:30:00" }] },
  { id: "PO-003", orderId: "ORD-001", customerName: "Uniformes del Norte", items: "500 Polos corporativos", quantity: 500, stage: "sewing", assignee: "Fernando L.", dueDate: "2026-04-20", daysInStage: 5, isDelayed: true, stageHistory: [{ stage: "design", enteredAt: "2026-03-30T09:00:00" }, { stage: "cutting", enteredAt: "2026-04-01T14:00:00" }, { stage: "sewing", enteredAt: "2026-04-04T11:00:00" }] },
  { id: "PO-004", orderId: "ORD-006", customerName: "Uniformes del Norte", items: "200 Pantalones cargo", quantity: 200, stage: "embroidery", assignee: "Rosa V.", dueDate: "2026-04-15", daysInStage: 2, isDelayed: true, stageHistory: [{ stage: "design", enteredAt: "2026-03-28T11:30:00" }, { stage: "cutting", enteredAt: "2026-03-30T09:00:00" }, { stage: "sewing", enteredAt: "2026-04-02T08:00:00" }, { stage: "embroidery", enteredAt: "2026-04-07T10:00:00" }] },
  { id: "PO-005", orderId: "ORD-004", customerName: "Textiles Monterrey", items: "400 Chalecos seguridad", quantity: 400, stage: "quality", assignee: "Miguel A.", dueDate: "2026-04-10", daysInStage: 1, isDelayed: false, stageHistory: [{ stage: "design", enteredAt: "2026-03-15T16:00:00" }, { stage: "cutting", enteredAt: "2026-03-18T09:00:00" }, { stage: "sewing", enteredAt: "2026-03-22T10:00:00" }, { stage: "embroidery", enteredAt: "2026-03-26T14:00:00" }, { stage: "quality", enteredAt: "2026-04-01T11:00:00" }] },
];

export const productionStages = [
  { key: "design" as const, label: "Diseño", color: "info" },
  { key: "cutting" as const, label: "Corte", color: "warning" },
  { key: "sewing" as const, label: "Confección", color: "accent" },
  { key: "embroidery" as const, label: "Bordado", color: "primary" },
  { key: "quality" as const, label: "Calidad", color: "success" },
  { key: "printing" as const, label: "Estampado", color: "warning" },
  { key: "dispatch" as const, label: "Despacho", color: "muted" },
] as const;

export const dashboardStats = {
  ordersInProgress: 4,
  delayedOrders: 2,
  avgDeliveryDays: 18,
  monthlyRevenue: 390000,
  monthlyProfit: 102500,
  avgMargin: 27.5,
  quotationsPending: 2,
  customersActive: 5,
};
