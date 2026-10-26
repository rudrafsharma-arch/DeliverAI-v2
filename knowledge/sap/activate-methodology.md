# SAP Activate Methodology

## Six Phases
1. Discover - Business case, landscape assessment, project charter
2. Prepare - Infrastructure, team onboarding, governance, transport setup
3. Explore - Fit-to-standard workshops, solution design, gap analysis, interface inventory
4. Realize - Configuration, development, integration, data migration, unit testing
5. Deploy - Cutover planning, data migration execution, go-live readiness, training
6. Run - AMS, incident management, continuous improvement, enhancements

## Document Standards
- Naming: [DocType]_[ProjectCode]_[Module]_[Process]_v[Version]_[Date]
- Versions: Draft=0.x, Review=0.9, Approved=1.0
- All docs need: Document Control, Purpose, Content, Open Issues, Sign-off

## Best Practices
- Always start with SAP Best Practices - customize only when justified
- Document every gap with business justification
- Use L1-L5 process hierarchy consistently
- Record all design decisions in decision log
- Follow sprint cadence (2-week sprints)
- Never configure directly in Production
- Use transport requests for ALL changes
- Mock cutover at least twice before go-live
- P1 incidents: 1-hour response, 4-hour resolution
- Monthly service review with client
