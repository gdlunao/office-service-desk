from enum import Enum


class UserRole(str, Enum):
    COLLABORATOR = "collaborator"
    TECHNICIAN = "technician"
    IT_MANAGER = "it_manager"