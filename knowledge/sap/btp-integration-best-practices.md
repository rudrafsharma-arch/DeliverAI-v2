# SAP BTP Integration Suite Best Practices

## iFlow Design
- Two-layer architecture: Receiver iFlow (technical) + Processing iFlow (functional)
- Never hardcode credentials - use Security Material store
- Always use Exception Subprocess for error handling
- Dead letter queue for all failed messages
- Alert notification via email/Teams for failures
- Log correlation ID for end-to-end tracing

## Naming Conventions
- iFlow: [Source]_to_[Target]_[Process]_[Version]
- Package: [Client]_[Domain]_Integrations
- Parameters: descriptive names like s4hana.host, coupa.api.key

## Groovy Script Standards
- Always import required packages
- Use try-catch in every method
- Log error with context information
- Return message object always

## Security
- OAuth2 for API authentication
- Certificate-based auth for SFTP
- Externalize all hostnames as parameters
- Rotate credentials regularly

## Transport Strategy
- DEV to QAS to PRD pipeline
- Integration test in QAS before PRD
- Monitor with Operations Cockpit
- Set alerts for failed messages

## Common Patterns
- Synchronous: HTTP Adapter to Request-Reply to Target
- Asynchronous: Source to Queue to iFlow to Target
- Content-Based Routing: Source to Router to multiple targets
- Aggregator: Source to Splitter to Process to Aggregator to Target
