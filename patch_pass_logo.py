import re

with open('src/pages/OrganizerDashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "hubName={hubData?.hubName || hub?.hubName || hubName || 'Event'}",
    "hubName={hubData?.hubName || hub?.hubName || hubName || 'Event'}\n          logoUrl={hubData?.logoUrl || hub?.logoUrl}"
)

with open('src/pages/OrganizerDashboard.tsx', 'w') as f:
    f.write(content)
