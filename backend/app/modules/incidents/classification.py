from enum import Enum


class IncidentCategory(str, Enum):
    CONNECTIVITY = "C1"
    EXTERNAL_PLATFORMS = "C2"
    INTERNAL_SYSTEM = "C3"
    DIGITAL_SIGNATURE = "C4"
    PRINTERS_SCANNERS = "C5"
    COMPUTERS = "C6"
    EMAIL_OFFICE = "C7"
    ACCESS_CREDENTIALS = "C8"


class IncidentImpact(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IncidentUrgency(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IncidentPriority(str, Enum):
    P1 = "p1"
    P2 = "p2"
    P3 = "p3"
    P4 = "p4"


_PRIORITY_MATRIX: dict[
    tuple[IncidentImpact, IncidentUrgency],
    IncidentPriority,
] = {
    (IncidentImpact.HIGH, IncidentUrgency.HIGH):
        IncidentPriority.P1,
    (IncidentImpact.HIGH, IncidentUrgency.MEDIUM):
        IncidentPriority.P1,
    (IncidentImpact.HIGH, IncidentUrgency.LOW):
        IncidentPriority.P2,

    (IncidentImpact.MEDIUM, IncidentUrgency.HIGH):
        IncidentPriority.P2,
    (IncidentImpact.MEDIUM, IncidentUrgency.MEDIUM):
        IncidentPriority.P3,
    (IncidentImpact.MEDIUM, IncidentUrgency.LOW):
        IncidentPriority.P3,

    (IncidentImpact.LOW, IncidentUrgency.HIGH):
        IncidentPriority.P3,
    (IncidentImpact.LOW, IncidentUrgency.MEDIUM):
        IncidentPriority.P4,
    (IncidentImpact.LOW, IncidentUrgency.LOW):
        IncidentPriority.P4,
}


def calculate_priority(
    impact: IncidentImpact,
    urgency: IncidentUrgency,
) -> IncidentPriority:
    return _PRIORITY_MATRIX[(impact, urgency)]