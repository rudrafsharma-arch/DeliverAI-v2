# SAP S/4HANA Private Cloud Edition (PCE) Knowledge Base

## Overview
S/4HANA Private Cloud Edition is single-tenant managed cloud hosted by SAP on AWS/Azure/GCP.
SAP manages infrastructure and basis. Customer controls upgrade schedule.
Primary commercial model: RISE with SAP.

## Key Characteristics
- Single-tenant: dedicated infrastructure per customer
- Customer controls upgrade timing (within SAP support windows)
- SAP manages infrastructure, patching, backups, basis
- Classical ABAP allowed (more flexibility than Public Cloud)
- RISE with SAP bundle: S/4HANA PCE + BTP + Integration Suite + Analytics Cloud starter

## Extensibility in Private Cloud
### Allowed (more than Public Cloud)
- Classical ABAP modifications (with caution)
- Z-programs, Z-tables, function modules
- User exits, classical BAdIs, enhancement spots
- Custom Fiori apps (SAPUI5)
- Custom reports, interfaces, conversions

### Recommended — Clean Core Journey
Even though modifications are allowed, SAP recommends moving toward Clean Core:
- Use side-by-side extensibility on BTP where possible
- Track custom code with SAP Custom Code Migration app
- Prepare architecture for eventual Public Cloud migration
- Document all modifications for future remediation

## Key Differences: PCE vs Public Cloud vs On-Premise
| Feature | Private Cloud (PCE) | Public Cloud | On-Premise |
|---------|---------------------|-------------|------------|
| Tenancy | Single | Multi | Single |
| Updates | Customer controlled | Mandatory quarterly | Customer controlled |
| ABAP | Classical + Cloud | Cloud ABAP only | Full classical |
| Infrastructure | SAP managed | SAP managed | Customer managed |
| Clean Core | Recommended | Mandatory | Optional |
| Timeline | 9-18 months | 4-6 months | 12-24 months |
| WRICEF | Allowed | Not recommended | Allowed |

## SAP Activate for Private Cloud
- Full SAP Activate methodology
- WRICEF allowed but minimise — use extensibility tools
- Fit-to-Standard workshops critical
- Delta design for all gaps
- Standard migration: LTMC, Migration Object Modeler, BODS
- System conversion (brownfield) or new implementation (greenfield/bluefield)

## RISE with SAP Components
- S/4HANA Private Cloud (core ERP)
- SAP BTP (extension platform)
- SAP Integration Suite (iPaaS)
- SAP Analytics Cloud (starter edition)
- SAP Business Network (supplier connectivity)
- SAP Enterprise Support (included)
- Migration and Modernisation program

## Infrastructure
- Hosted on AWS, Azure, or GCP (customer selects region)
- SAP manages: servers, OS, database (HANA), basis operations
- Customer manages: application config, transports, users, custom code
- System landscape: Sandbox → DEV → QAS → PRD
- Backup and DR managed by SAP

## Transport Management
- Standard CTS (Change and Transport System) — STMS
- SAP Cloud ALM for project management and testing
- Focused Build for agile/scaled delivery

## Integration in Private Cloud
- SAP Integration Suite (included in RISE)
- Cloud Connector required for on-premise connectivity
- Both RFC/BAPI and OData APIs supported
- SAP Event Mesh for async/event-driven scenarios
- API Management for exposing APIs

## AMS Model in PCE
- SAP manages: infrastructure, basis, patching, HANA
- SI/Customer manages: application support, enhancements, incidents
- Hypercare: typically 4-8 weeks post go-live
- Ticketing: SAP for infrastructure, SI for application

## Common PCE Challenges
1. Network connectivity — Cloud Connector setup and performance
2. Custom code volume — assessment and remediation effort
3. Data migration — volumes and complexity
4. Cutover planning — system freeze timing
5. BASIS handover from customer team to SAP
6. Licence reconciliation in RISE model

## Migration Paths to PCE
- Brownfield (System Conversion): SUM + DMO, keep data and config
- Greenfield (New Implementation): fresh start, migrate data only
- Bluefield (Selective Data Transition): mix of both via SNP/Datavard tools
- Shell Conversion: new system, migrate select historical data
