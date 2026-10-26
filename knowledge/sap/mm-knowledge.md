# SAP MM (Materials Management) Knowledge Base

## Core MM Modules
- Purchasing (MM-PUR): Purchase orders, contracts, scheduling agreements
- Inventory Management (MM-IM): Goods movements, stock management
- Invoice Verification (MM-IV): Logistics invoice verification, GR/IR clearing
- Material Master (MM-BD): Material types, MRP views, plant data
- Warehouse Management (MM-WM): Storage locations, transfer orders
- Batch Management: Batch classification, shelf life management

## Key S/4HANA MM Changes
- Material Ledger mandatory — actual costing
- Stock transport orders simplified
- New purchasing conditions schema
- Simplified supplier evaluation
- Embedded EWM replaces classic WM for complex warehouses
- MRP Live for real-time material planning

## Common MM Configuration Objects
- Plant (OX10)
- Storage Location (OX09)
- Purchasing Organization (OX08)
- Purchasing Group
- Material Type (OMS2)
- MRP Type
- Valuation Class
- Account Assignment Category
- Document Types for PO/GR

## Key MM Transaction Codes
- ME21N: Create Purchase Order
- ME51N: Create Purchase Requisition
- MIGO: Goods Movement
- MIRO: Logistics Invoice Verification
- MM01: Create Material Master
- MB52: Warehouse stocks
- ME2M: Purchase orders by material
- MR11: GR/IR account maintenance

## MM Integration Points
- MM-FI: Automatic account determination, GR/IR clearing
- MM-SD: Delivery from plant to customer
- MM-PP: Production orders consuming materials
- MM-QM: Quality inspection during goods receipt
- MM-WM: Warehouse transfers triggered by MIGO

## Common MM Business Processes
1. Purchase to Pay: PR → PO → GR → Invoice → Payment
2. Inventory Management: Goods receipt → storage → transfer → issue
3. Physical Inventory: Count → difference → adjustment
4. Consignment: Vendor managed inventory, consignment settlement

## MM Public Cloud Considerations
- Use API_PURCHASEORDER_PROCESS_SRV for PO integration
- API_MATERIAL_DOCUMENT_SRV for goods movements
- Released APIs only — no direct access to EKKO/EKPO
- Use Business Events for MM events in Event Mesh
