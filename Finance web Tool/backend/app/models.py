from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


TOWER_CODES = ('FPA', 'RTR', 'O2C', 'P2P')
TOWER_LABELS = {
    'FPA': 'FP&A',
    'RTR': 'RTR',
    'O2C': 'O2C',
    'P2P': 'P2P',
}


class User(BaseModel):
    id: str
    name: str
    role: str
    email: str = ''


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    role: str
    email: str
    password: str


class DealMember(BaseModel):
    userId: str
    userName: str
    role: str
    towerCode: str | None = None


class DealCollaborator(BaseModel):
    id: str
    name: str
    email: str
    towerCode: str


class TowerWorkspaceSummary(BaseModel):
    towerCode: str
    towerLabel: str
    status: str = 'Not Started'
    assignedUserId: str | None = None
    assignedUserName: str = ''
    inScope: bool = True
    version: int = 1


class DealPayload(BaseModel):
    model_config = ConfigDict(extra='allow')

    id: str | None = None
    draftLabel: str = ''
    clientName: str = ''
    dealId: str = ''
    programName: str = ''
    presalesLead: str = ''
    bidDate: str = ''
    dealStatus: str = 'Draft'
    watermark: str = 'INDICATIVE'
    contractTerm: str = '5'
    discountRate: str = '10'
    corporateOverhead: str = '0'
    displayCurrency: str = 'USD'
    fxRate: str = '1'
    customerFinanceFte: str = ''
    financeCostBaseline: str = ''
    pricingConstruct: str = 'FTE-based'
    transitionCommercials: str = 'Separate fee'
    transformationFunding: str = 'Provider-funded'
    benchmarkPolicy: str = 'Auto'
    committedProdY2: str = ''
    committedProdY3: str = ''
    committedProdY4: str = ''
    notesTag: str = 'Internal'
    towerScope_FPA: bool = True
    towerScope_RTR: bool = True
    towerScope_O2C: bool = True
    towerScope_P2P: bool = True
    towerLead_FPA: str = ''
    towerLead_RTR: str = ''
    towerLead_O2C: str = ''
    towerLead_P2P: str = ''
    towerOwnerUserId_FPA: str = ''
    towerOwnerUserId_RTR: str = ''
    towerOwnerUserId_O2C: str = ''
    towerOwnerUserId_P2P: str = ''
    dealOwnerUserId: str | None = None
    dealOwnerName: str = ''
    documentIntake: dict = Field(default_factory=dict)
    collaborators: list[DealCollaborator] = Field(default_factory=list)
    reviewNotes: str = ''
    createdAt: str | None = None
    updatedAt: str | None = None


class Deal(DealPayload):
    id: str
    version: int = 1
    accessRole: str = 'viewer'
    members: list[DealMember] = Field(default_factory=list)
    towerWorkspaces: list[TowerWorkspaceSummary] = Field(default_factory=list)


class DealCollection(BaseModel):
    savedAt: str | None = None
    currentId: str | None = None
    deals: list[Deal] = Field(default_factory=list)


class MeSummary(BaseModel):
    user: User
    currentId: str | None = None
    ownedDeals: list[Deal] = Field(default_factory=list)
    assignedDeals: list[Deal] = Field(default_factory=list)
    pinnedDeals: list[Deal] = Field(default_factory=list)
    recentDeals: list[Deal] = Field(default_factory=list)

