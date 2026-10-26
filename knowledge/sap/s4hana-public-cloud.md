# SAP S/4HANA Public Cloud Knowledge Base

## Overview
S/4HANA Public Cloud is SAP's multi-tenant SaaS ERP running on SAP's managed infrastructure.
Released quarterly (4 releases/year). Customers cannot delay updates.
All customers on same code line — no customer modifications to standard code.

## Key Characteristics
- Multi-tenant: shared infrastructure, isolated data
- Quarterly mandatory updates — no choice to skip
- SAP manages infrastructure, upgrades, security patches
- Limited to SAP-released extensibility (Clean Core mandate)
- Available on AWS, Azure, GCP via SAP BTP
- Regions: US, EU, AP, etc.

## Clean Core Mandate — Critical
### TIER 1 — In-App Extensibility (No Code / Low Code)
- Custom Fields and Logic (via Key User Tools)
- Custom Business Objects (CBO) via SAP BTP Build
- Custom Analytical Queries
- Adaptation UI (hide/show fields, rename labels)
- Custom Forms and Reports

### TIER 2 — Side-by-Side Extensibility (Developer Extensions)
- SAP BTP extensions using CAP framework
- ABAP Cloud on BTP (Steampunk) for ABAP extensions
- SAP Build Apps for custom UIs
- SAP Build Process Automation for workflows
- Integration via SAP Integration Suite

### TIER 3 — NOT ALLOWED in Public Cloud
- Classical ABAP modifications (SE38, SE24, user exits with modification)
- Direct table modifications
- Classic BAdI implementations (only released BAdI APIs allowed)
- Access to non-released APIs (internal function modules, RFCs)
- Custom programs in standard namespaces

## ABAP Cloud (Steampunk) for Public Cloud
- Write ABAP on BTP ABAP Environment (Steampunk)
- Only ABAP Cloud compliant syntax
- Only released APIs (C1/C2 release contracts)
- Released APIs: look for @ReleaseState: RELEASED in ABAP Doc
- Use ABAP RESTful Application Programming Model (RAP)
- Deploy as OData services, not classical reports

## Released APIs — Key Ones
- BusinessPartner (API_BUSINESS_PARTNER)
- PurchaseOrder (API_PURCHASEORDER_PROCESS_SRV)
- SalesOrder (API_SALES_ORDER_SRV)
- JournalEntry (API_JOURNALENTRYITEMBASIC_SRV)
- ProductMaster (API_PRODUCT_SRV)
- CustomerMaterial (API_CUSTOMER_MATERIAL_INFO_SRV)
All available in SAP API Business Hub (api.sap.com)

## Integration Patterns for Public Cloud
- Use SAP Integration Suite for all integrations
- No direct RFC/BAPI calls from external systems
- Use OData V4 APIs exclusively for new integrations
- Use Business Events via SAP Event Mesh for async
- Cloud Connector NOT needed (all cloud-to-cloud)

## Key Differences vs On-Premise
| Feature | Public Cloud | On-Premise |
|---------|-------------|------------|
| Updates | Mandatory quarterly | Customer controlled |
| Customisation | Tier 1/2 only | Full modification |
| Infrastructure | SAP managed | Customer managed |
| ABAP | Cloud ABAP only | Full ABAP |
| BTP | Included | Add-on |
| Fiori | Standard only | Custom possible |

## SAP Activate for Public Cloud
- Fit-to-Standard workshops are MANDATORY
- Standard first — customise only if business critical
- No WRICEF — use extensibility tools instead
- Simplified testing — standard scenarios only
- Faster go-live — typically 4-6 months

## Common Public Cloud Challenges
1. Fit-to-Standard resistance from business users
2. Integration complexity (all API-based)
3. Master data migration (no LSMW — use LTMC/Migration Object Modeler)
4. Reporting limitations (use Embedded Analytics, SAP Analytics Cloud)
5. Quarterly update management (regression testing)

## Public Cloud Pricing
- Subscription-based (per user/month)
- Professional Users, Limited Users, Self-Service Users
- Additional BTP credits for extensions
- Integration Suite separate subscription
