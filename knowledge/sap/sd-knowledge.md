# SAP SD (Sales and Distribution) Knowledge Base

## Core SD Modules
- Sales (SD-SLS): Sales orders, quotations, contracts
- Shipping (SD-SHP): Deliveries, picking, goods issue
- Billing (SD-BIL): Invoices, credit/debit memos, pro forma
- Pricing (SD-PRC): Condition technique, pricing procedures
- Credit Management (SD-CM): Credit checks, credit limits
- Foreign Trade (SD-FT): Export/import, Intrastat

## Key S/4HANA SD Changes
- Simplified sales order processing
- Advanced Available to Promise (aATP)
- Output Management replaced classic output determination
- New credit management (FIN-FSCM-CR)
- Product allocation
- Demand-driven replenishment

## Common SD Configuration Objects
- Sales Organization (OVX5)
- Distribution Channel (OVXI)
- Division (OVXB)
- Sales Area combination
- Document Types (VOV8)
- Item Categories (VOV7)
- Schedule Line Categories (VOV6)
- Pricing Procedure (OVKK)
- Condition Types (V/06)

## Key SD Transaction Codes
- VA01: Create Sales Order
- VA11: Create Inquiry
- VA21: Create Quotation
- VL01N: Create Outbound Delivery
- VF01: Create Billing Document
- VK11: Create Condition Records
- V/08: Pricing Procedure
- VKOA: Account Determination

## SD Integration Points
- SD-FI: Revenue posting, accounts receivable
- SD-MM: Goods issue from warehouse, stock check
- SD-PP: Make-to-order production trigger
- SD-CS: Service orders, repairs
- SD-CRM: Customer master, contact persons

## Common SD Business Processes
1. Order to Cash: Inquiry → Quote → Order → Delivery → Billing → Payment
2. Returns: Return order → returns delivery → credit memo
3. Consignment: Fill-up → issue → settlement
4. Third Party: Sales order → PR → PO → vendor delivery → billing

## SD Public Cloud APIs
- API_SALES_ORDER_SRV: Sales order processing
- API_OUTBOUND_DELIVERY_SRV: Delivery management
- API_BILLING_DOCUMENT_SRV: Billing documents
- API_CUSTOMER_MATERIAL_INFO_SRV: Customer-material info records
