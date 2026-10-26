# SAP HR/HCM (Human Capital Management) Knowledge Base

## Core HCM Modules
- Personnel Administration (PA): Employee master, org assignment
- Organisational Management (OM): Org structure, positions, jobs
- Time Management (PT): Attendances, absences, work schedules
- Payroll (PY): Gross/net calculation, remuneration
- Personnel Development (PD): Appraisals, training, succession
- Recruitment (PB): Applicants, job postings

## SAP SuccessFactors (Cloud HCM)
- Employee Central: Core HR, org management
- Recruiting: Job requisitions, candidate management
- Onboarding: New hire process, compliance
- Performance & Goals: Continuous performance, OKRs
- Learning: LMS, compliance training
- Compensation: Merit, bonus planning
- Workforce Analytics: Headcount, turnover reports

## Key S/4HANA HCM Changes
- SAP recommends SuccessFactors for new implementations
- Integration via SAP Integration Suite (Employee Central → S/4HANA)
- Payroll can stay on-premise or move to Employee Central Payroll
- Position Management simplified
- Fiori apps for manager self-service

## Common HCM Integration Patterns
- SuccessFactors EC → S/4HANA: Employee replication via Integration Suite
- Payroll → FI: Payroll posting using PPOIX
- Time → Payroll: Time evaluation results feeding payroll
- HCM → Active Directory: User provisioning via Identity Management

## Key HCM Transaction Codes
- PA30: Maintain HR Master Data
- PA20: Display HR Master Data
- PP01: Maintain Org Objects
- PT50: Absence Quota Overview
- PC00_M99_CIPE: Payroll simulation
- S_AHR_61016362: Org Chart

## Common HR Infotypes
- IT0000: Actions
- IT0001: Org Assignment
- IT0002: Personal Data
- IT0006: Addresses
- IT0007: Planned Working Time
- IT0008: Basic Pay
- IT0041: Date Specifications

## SuccessFactors Integration APIs
- SF OData API: Employee Central data
- SFAPI: Legacy SuccessFactors API
- Compound Employee API: Bulk employee data
- Integration Center: Pre-built integration templates
- MDF (Metadata Framework): Custom objects

## Common HR Business Processes
1. Hire to Retire: Recruitment → Onboarding → Development → Offboarding
2. Time to Pay: Time recording → Approval → Payroll → FI posting
3. Learning & Development: Training needs → Course → Certification
4. Performance: Goal setting → Mid-year → Year-end → Calibration
