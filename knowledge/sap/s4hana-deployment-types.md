# SAP S/4HANA Deployment Types Guide

## Public Cloud (SaaS)
- True multi-tenant SaaS, continuous quarterly updates
- NO custom ABAP development allowed
- Extensions via BTP only: CAP, SAP Build Apps, SAP Build Work Zone
- Configuration via Manage Your Solution (no SPRO)
- Key User Extensibility: Custom Fields, Custom Logic, Custom Business Objects
- BAdIs via Key User Tools only - no SE18/SE19
- No transport requests - configuration promoted via migration
- Integration via BTP Integration Suite or pre-built connectors

## Private Cloud / PCE
- Hosted on hyperscaler managed by SAP
- Full ABAP development allowed
- Own transport landscape DEV to QAS to PRD
- RAP and classic ABAP both supported
- SPRO configuration available
- Own upgrade schedule - not continuous
- Access to ABAP workbench SE80, SE38 etc

## On-Premise
- Fully customer managed
- Full ABAP development
- Classic transport management CTS
- Most flexibility, most responsibility
- All ABAP tools available

## Agent Rules by Deployment Type

### Public Cloud
- ABAP Generator: Not applicable - suggest BTP CAP instead
- RICEFW: Only I, F, W - no custom ABAP reports or enhancements
- Technical Spec: Focus on BTP extensions, CAP, Key User tools
- Config Doc: Use Manage Your Solution steps, not SPRO
- Always recommend standard over custom
- Fit-to-Standard is critical

### Private Cloud PCE
- Full ABAP and RAP development allowed
- Use RAP for all new S/4HANA development
- Own transport landscape applies
- SPRO configuration available

### On-Premise
- Full classic ABAP allowed
- RAP available from S/4HANA 1909 onwards
- All RICEFW types applicable

## ABAP in Public Cloud - Correction
ABAP Generator IS applicable for Public Cloud but with restrictions:
- Use ABAP Cloud development model only
- RAP is the only programming model allowed
- Only released APIs Tier 1 can be consumed
- No direct database table access - use CDS views only
- No classic ABAP statements like SELECT on SAP tables directly
- BTP ABAP Environment (Steampunk) for custom ABAP in Public Cloud
- ABAP for Cloud restricts usage of obsolete and incompatible statements
- Clean Core principle - keep S/4 core clean, extend via BTP
