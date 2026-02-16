# Voice Vibe Coding - Salesforce Project

This project contains a Lightning Web Component to display a list of opportunities.

## Components

### Opportunity List Component
A Lightning Web Component that displays all opportunities in the org in a table format with the following information:
- Opportunity Name (clickable link)
- Account Name
- Amount (formatted as currency)
- Stage
- Close Date
- Owner

## Deployment Instructions

1. **Deploy to your Salesforce org:**
   ```bash
   sf project deploy start --target-org voice-vibe-coding-dev
   ```

2. **Assign Permission Set (if needed):**
   - The System Administrator profile has access by default
   - For other profiles, assign the "Opportunity List Access" permission set
   - Go to Setup → Permission Sets → Opportunity List Access → Manage Assignments

3. **Add Component to a Page:**
   - Go to Setup → Lightning App Builder
   - Create a new App Page or edit an existing one
   - Drag the "Opportunity List" component onto the page
   - Save and activate the page

## Component Access

The component is accessible to:
- System Administrator profile (by default)
- Any profile with the "Opportunity List Access" permission set assigned

## Files Structure

```
force-app/
├── main/
│   └── default/
│       ├── classes/
│       │   ├── OpportunityController.cls
│       │   └── OpportunityController.cls-meta.xml
│       ├── lwc/
│       │   └── opportunityList/
│       │       ├── opportunityList.html
│       │       ├── opportunityList.js
│       │       └── opportunityList.js-meta.xml
│       └── permissionsets/
│           └── OpportunityList_Access.permissionset-meta.xml
```

## Usage

Once deployed and added to a Lightning page, the component will automatically load and display all opportunities in the org, sorted by creation date (newest first).
