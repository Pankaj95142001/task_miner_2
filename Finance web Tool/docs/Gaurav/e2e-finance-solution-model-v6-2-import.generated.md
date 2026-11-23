# Workbook import report

Generated: `2026-10-28T05:15:00Z`

## Imported deal

- Deal record: `deal-20261028051500374442`
- Draft label: `E2E Finance Solution Model v6.2`
- Deal ID: `KDP-DVE-RFP-2026`
- Client: `Keurig Dr Pepper (KDP) — BevCo`
- Workbook: `E2E_Finance_Solution_Model_v6.2.xlsx`

## Captured workbook sheets

| Sheet | Non-empty cells cached |
| --- | ---: |
| E2E Calibration Closure | 496 |
| E2E Deal Master | 82 |
| E2E Evidence Register | 394 |
| FPA_01 Deal Setup | 64 |
| FPA_02 Discovery | 966 |
| FPA_03 Scope L3 | 565 |
| FPA_04 Benchmarks | 520 |
| FPA_05 Workload | 295 |
| FPA_06 Complexity | 78 |
| FPA_07 Personas | 159 |
| FPA_08 AI Benefit | 1208 |
| FPA_09 Ops Model | 265 |
| FPA_10 Rate Card | 157 |
| FPA_11 FTE Engine | 397 |
| FPA_12 Cost | 478 |
| FPA_13 Pricing | 106 |
| FPA_14 Outcome | 59 |
| FPA_15 Transition | 186 |
| FPA_16 Business Case | 431 |
| FPA_17 Sensitivity | 140 |
| FPA_18 Risk | 215 |
| FPA_19 Deal Risks | 58 |
| FPA_20 Recommend | 117 |
| FPA_21 Client Value | 89 |
| FPA_22 Dashboard | 322 |
| FPA_23 Trace Log | 23 |
| FPA_24 Governance | 48 |
| FPA_25 Confidence | 220 |
| FPA_26 Calibration | 372 |
| FPA_27 Benchmark Pack | 256 |
| FPA_28 Change Log | 76 |
| FPA_29 L3 Business View | 671 |
| FPA_30 SCPL | 635 |
| FPA_31 Sizing & Band Mix | 1063 |

## Import assumptions

- The portal deal is cloned from the current seeded portal deal so existing access control, collaborators, and downstream portal structure remain intact.
- Workbook Deal Master, FP&A Discovery, Discovery Coverage, Pain Points, and Scope L2/L3 are imported directly from the attached workbook.
- Portal owner and tower-user mappings remain the current local users so the imported deal stays visible after login.
- Additional workbook-backed FP&A sheet cells are stored under fpaWorkbookInputs for parity with workbook-driven pages and downstream readers.

## Field references

| Section | Portal path | Workbook ref | Portal value | Workbook value | Notes |
| --- | --- | --- | --- | --- | --- |
| Deal Master | clientName | E2E Deal Master / D6 | Keurig Dr Pepper (KDP) — BevCo | Keurig Dr Pepper (KDP) — BevCo | Imported from workbook deal master. |
| Deal Master | dealId | E2E Deal Master / D7 | KDP-DVE-RFP-2026 | KDP-DVE-RFP-2026 | Imported from workbook deal master. |
| Deal Master | presalesLead | E2E Deal Master / D8 | <Name> | <Name> | Imported from workbook deal master. |
| Deal Master | bidDate | E2E Deal Master / D9 | 2026-08-12 | 12-Aug-2026 | Imported from workbook deal master. |
| Deal Master | contractTerm | E2E Deal Master / D11 | 5 | 5 | Imported from workbook deal master. |
| Deal Master | discountRate | E2E Deal Master / D12 | 10 | 0.1 | Imported from workbook deal master. |
| Deal Master | displayCurrency | E2E Deal Master / D16 | USD | USD | Imported from workbook deal master. |
| Deal Master | fxRate | E2E Deal Master / D17 | 1 | 1 | Imported from workbook deal master. |
| Deal Master | pricingConstruct | E2E Deal Master / D20 | FTE-based | FTE-based | Imported from workbook deal master. |
| Deal Master | transitionCommercials | E2E Deal Master / D21 | Separate fee | Separate fee | Imported from workbook deal master. |
| Deal Master | transformationFunding | E2E Deal Master / D22 | Provider-funded | Provider-funded | Imported from workbook deal master. |
| Deal Master | benchmarkPolicy | E2E Deal Master / D25 | Auto | Auto | Imported from workbook deal master. |
| Deal Master | corporateOverhead | E2E Deal Master / D26 | 0 | 0 | Imported from workbook deal master. |
| Deal Master | committedProdY2 | E2E Deal Master / D29 |  |  | Imported from workbook deal master. |
| Deal Master | committedProdY3 | E2E Deal Master / D30 |  |  | Imported from workbook deal master. |
| Deal Master | committedProdY4 | E2E Deal Master / D31 |  |  | Imported from workbook deal master. |
| Deal Master | customerFinanceFte | E2E Deal Master / D43 |  |  | Imported from workbook deal master. |
| Deal Master | financeCostBaseline | E2E Deal Master / D44 |  |  | Imported from workbook deal master. |
| Deal Master | programName | E2E Deal Master / D45 | KDP AI-First Digital Value Engine (DVE) — BOTT | KDP AI-First Digital Value Engine (DVE) — BOTT | Imported from workbook deal master. |
| Deal Master > Tower Scope | towerScope_FPA | E2E Deal Master / D36 | True | Yes | KDP 'P2P' = Plan-to-Perform (Appendix P4) — KDP data loaded in FPA_ tabs |
| Deal Master > Tower Scope | towerLead_FPA | E2E Deal Master / E36 | <Name> | <Name> | Workbook lead; portal access stays mapped to existing users. |
| Deal Master > Tower Scope | towerScope_RTR | E2E Deal Master / D37 | True | Yes |  |
| Deal Master > Tower Scope | towerLead_RTR | E2E Deal Master / E37 | <Name> | <Name> | Workbook lead; portal access stays mapped to existing users. |
| Deal Master > Tower Scope | towerScope_O2C | E2E Deal Master / D38 | True | Yes |  |
| Deal Master > Tower Scope | towerLead_O2C | E2E Deal Master / E38 | <Name> | <Name> | Workbook lead; portal access stays mapped to existing users. |
| Deal Master > Tower Scope | towerScope_P2P | E2E Deal Master / D39 | True | Yes | Template P2P = Procure-to-Pay (= KDP 'S2P') — still template sample data |
| Deal Master > Tower Scope | towerLead_P2P | E2E Deal Master / E39 | <Name> | <Name> | Workbook lead; portal access stays mapped to existing users. |
| FP&A Discovery | fpaWorkspace.discovery.industryVertical | FPA_02 Discovery / D7 / E7 | CPG & Retail | CPG & Retail | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.annualRevenueUsdM | FPA_02 Discovery / D8 / E8 | 12.5 | 12.5 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.legalEntities | FPA_02 Discovery / D10 / E10 | 58 | 58 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.businessUnits | FPA_02 Discovery / D11 / E11 | 5 | 5 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.employeeCount000 | FPA_02 Discovery / D12 / E12 | 27.5 | 27.5 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.geoCountries | FPA_02 Discovery / D13 / E13 | 4 | 4 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.languagesBeyondEnglish | FPA_02 Discovery / D14 / E14 | 2 | 2 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.costCentres | FPA_02 Discovery / D15 / E15 | 2010 | 2010 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.productServiceLines | FPA_02 Discovery / D16 / E16 |  |  | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.forecastCadence | FPA_02 Discovery / D17 / E17 | Quarterly | Quarterly | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.planningIterationsPerBudget | FPA_02 Discovery / D18 / E18 |  |  | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.forecastVersionsMaintained | FPA_02 Discovery / D19 / E19 |  |  | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.reportPacksPerMonth | FPA_02 Discovery / D20 / E20 | 174.75 | 174.75 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.adhocAnalysisIntensity | FPA_02 Discovery / D21 / E21 | High | High | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.epmPlatform | FPA_02 Discovery / D22 / E22 | IBM Planning Analytics | IBM Planning Analytics | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.monthlyCloseComplexity | FPA_02 Discovery / D23 / E23 | Simple (<=5 days) | Simple (<=5 days) | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.processMaturity | FPA_02 Discovery / D24 / E24 | Developing | Developing | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.automationMaturity | FPA_02 Discovery / D25 / E25 | Low (<20%) | Low (<20%) | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.aiMaturity | FPA_02 Discovery / D26 / E26 | Piloting | Piloting | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.digitalMaturity | FPA_02 Discovery / D27 / E27 | Traditional | Traditional | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.competitiveIntensity | FPA_02 Discovery / D28 / E28 | High (5+ bidders) | High (5+ bidders) | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.platformModernizationInScope | FPA_02 Discovery / D29 / E29 | No | No | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.peakMonth1 | FPA_02 Discovery / D30 / E30 | Oct | Oct | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.peakMonth2 | FPA_02 Discovery / D31 / E31 | Nov | Nov | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.peakMonth3 | FPA_02 Discovery / D32 / E32 | Jan | Jan | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.retainedOrgIntent | FPA_02 Discovery / D33 / E33 | Hybrid | Hybrid | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.dataSourcesCount | FPA_02 Discovery / D34 / E34 | 14 | 14 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.currentTowerStaff | FPA_02 Discovery / D35 / E35 | 444.1 | 444.1 | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.currentTowerCostBaselineUsd | FPA_02 Discovery / D36 / E36 |  |  | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.erpLandscape | FPA_02 Discovery / D64 / E64 | Fragmented (4+ ERPs / spreadsheets) | Fragmented (4+ ERPs / spreadsheets) | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.consolidationApproach | FPA_02 Discovery / D65 / E65 | OneStream / FCCS / HFM in place | OneStream / FCCS / HFM in place | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.biLandscape | FPA_02 Discovery / D66 / E66 | BI present, ungoverned | BI present, ungoverned | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.dataMartMaturity | FPA_02 Discovery / D67 / E67 | Partial data marts | Partial data marts | Workbook discovery import. |
| FP&A Discovery | fpaWorkspace.discovery.governanceMode | FPA_02 Discovery / D68 / E68 | Manual governance | Manual governance | Workbook discovery import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.volumesCoreDrivers | FPA_02 Discovery / H41 | Yes | Yes | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.currentFteByProcess | FPA_02 Discovery / H42 | Yes | Yes | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.platformAndMaturity | FPA_02 Discovery / H43 | Yes | Yes | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.automationAlreadyAchieved | FPA_02 Discovery / H44 | No | No | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.kpiBaselineCycleMetrics | FPA_02 Discovery / H45 | No | No | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.activityInventory | FPA_02 Discovery / H46 | No | No | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.closeCalendar | FPA_02 Discovery / H47 | No | No | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.existingSlasKpis | FPA_02 Discovery / H48 | No | No | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.currentCostBaseline | FPA_02 Discovery / H49 | No | No | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.painPointsPriorities | FPA_02 Discovery / H50 | Yes | Yes | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.retainedOrgIntentShared | FPA_02 Discovery / H51 | Yes | Yes | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.dataSourceLandscape | FPA_02 Discovery / H52 | Yes | Yes | Workbook coverage checklist import. |
| FP&A Discovery Coverage | fpaWorkspace.discoveryCoverage.peakCalendarConfirmed | FPA_02 Discovery / H53 | No | No | Workbook coverage checklist import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.budgetCycleTooLong | FPA_02 Discovery / D80 / E80 | {"present": "No", "severity": ""} | No | Workbook pain-point import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.forecastAccuracyPoor | FPA_02 Discovery / D81 / E81 | {"present": "Yes", "severity": "Medium"} | Yes | Workbook pain-point import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.excelDependentConsolidation | FPA_02 Discovery / D82 / E82 | {"present": "Yes", "severity": "High"} | Yes | Workbook pain-point import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.reportProliferation | FPA_02 Discovery / D83 / E83 | {"present": "Yes", "severity": "Medium"} | Yes | Workbook pain-point import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.lateCloseDelays | FPA_02 Discovery / D84 / E84 | {"present": "No", "severity": ""} | No | Workbook pain-point import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.weakDriverGovernance | FPA_02 Discovery / D85 / E85 | {"present": "Yes", "severity": "High"} | Yes | Workbook pain-point import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.limitedScenarioCapability | FPA_02 Discovery / D86 / E86 | {"present": "Yes", "severity": "High"} | Yes | Workbook pain-point import. |
| FP&A Discovery Pain Points | fpaWorkspace.discoveryPainPoints.businessPartnersConsumedByDataPrep | FPA_02 Discovery / D87 / E87 | {"present": "Yes", "severity": "Critical"} | Yes | Workbook pain-point import. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.strategicLongRangePlanning | FPA_03 Scope L3 / D62 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.budgetingPlanning | FPA_03 Scope L3 / D63 | {"status": "Y", "partialPct": "1", "sourceLabel": "Workbook roll-up"} | 1 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.rollingForecastingIbp | FPA_03 Scope L3 / D64 | {"status": "Y", "partialPct": "1", "sourceLabel": "Workbook roll-up"} | 1 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.commercialForecasting | FPA_03 Scope L3 / D65 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.costProductivityMarginManagement | FPA_03 Scope L3 / D66 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.workforceCapacityPlanning | FPA_03 Scope L3 / D67 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.cashFlowCapitalPlanning | FPA_03 Scope L3 / D68 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.variancePerformanceManagement | FPA_03 Scope L3 / D69 | {"status": "Y", "partialPct": "1", "sourceLabel": "Workbook roll-up"} | 1 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.managementReportingDecisionSupport | FPA_03 Scope L3 / D70 | {"status": "Y", "partialPct": "1", "sourceLabel": "Workbook roll-up"} | 1 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.scenarioRiskModeling | FPA_03 Scope L3 / D71 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.profitabilityPricingBusinessCases | FPA_03 Scope L3 / D72 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L2 | fpaWorkspace.scopeL2.governanceMasterDataBusinessPartnering | FPA_03 Scope L3 / D73 | {"status": "N", "partialPct": "0", "sourceLabel": "Workbook roll-up"} | 0 | Imported from workbook roll-up Final %. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.strategicLrpModelBuildRefresh | FPA_03 Scope L3 / F6 / G6 / I6 / J6 / K6 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.strategicScenarioSupport | FPA_03 Scope L3 / F7 / G7 / I7 / J7 / K7 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.strategicTargetCascade | FPA_03 Scope L3 / F8 / G8 / I8 / J8 / K8 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.strategicBoardStrategyPackSupport | FPA_03 Scope L3 / F9 / G9 / I9 / J9 / K9 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.annualCalendarTemplates | FPA_03 Scope L3 / F10 / G10 / I10 / J10 / K10 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.annualTargetSettingSupport | FPA_03 Scope L3 / F11 / G11 / I11 / J11 / K11 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.annualSubmissionCollectionValidation | FPA_03 Scope L3 / F12 / G12 / I12 / J12 / K12 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.annualConsolidationIteration | FPA_03 Scope L3 / F13 / G13 / I13 / J13 / K13 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.annualBridgeWalkAnalysis | FPA_03 Scope L3 / F14 / G14 / I14 / J14 / K14 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.annualApprovalPack | FPA_03 Scope L3 / F15 / G15 / I15 / J15 / K15 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.forecastDataStagingValidation | FPA_03 Scope L3 / F16 / G16 / I16 / J16 / K16 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.forecastDriverUpdate | FPA_03 Scope L3 / F17 / G17 / I17 / J17 / K17 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.forecastBuCollection | FPA_03 Scope L3 / F18 / G18 / I18 / J18 / K18 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.forecastConsolidationVersionControl | FPA_03 Scope L3 / F19 / G19 / I19 / J19 / K19 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.forecastIbpSopAlignment | FPA_03 Scope L3 / F20 / G20 / I20 / J20 / K20 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.forecastAccuracyTracking | FPA_03 Scope L3 / F21 / G21 / I21 / J21 / K21 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.revenuePipelineBacklogAnalytics | FPA_03 Scope L3 / F22 / G22 / I22 / J22 / K22 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.revenuePricingVolumeMixAnalysis | FPA_03 Scope L3 / F23 / G23 / I23 / J23 / K23 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.revenueModelMaintenance | FPA_03 Scope L3 / F24 / G24 / I24 / J24 / K24 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.revenueCommercialReviewsSupport | FPA_03 Scope L3 / F25 / G25 / I25 / J25 / K25 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.costCentreReporting | FPA_03 Scope L3 / F26 / G26 / I26 / J26 / K26 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.spendAnalytics | FPA_03 Scope L3 / F27 / G27 / I27 / J27 / K27 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.productivityTracking | FPA_03 Scope L3 / F28 / G28 / I28 / J28 / K28 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.allocationMaintenance | FPA_03 Scope L3 / F29 / G29 / I29 / J29 / K29 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.workforceHeadcountReporting | FPA_03 Scope L3 / F30 / G30 / I30 / J30 / K30 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.workforcePositionVacancyTracking | FPA_03 Scope L3 / F31 / G31 / I31 / J31 / K31 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.workforceCostModelling | FPA_03 Scope L3 / F32 / G32 / I32 / J32 / K32 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.cashDirectIndirectForecast | FPA_03 Scope L3 / F33 / G33 / I33 / J33 / K33 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.cashCapexBusinessCaseSupport | FPA_03 Scope L3 / F34 / G34 / I34 / J34 / K34 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.cashWorkingCapitalAnalytics | FPA_03 Scope L3 / F35 / G35 / I35 / J35 / K35 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.varianceFlashResults | FPA_03 Scope L3 / F36 / G36 / I36 / J36 / K36 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.varianceDecomposition | FPA_03 Scope L3 / F37 / G37 / I37 / J37 / K37 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.varianceCommentaryDrafting | FPA_03 Scope L3 / F38 / G38 / I38 / J38 / K38 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.varianceKpiScorecards | FPA_03 Scope L3 / F39 / G39 / I39 / J39 / K39 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.variancePerformanceReviewPacks | FPA_03 Scope L3 / F40 / G40 / I40 / J40 / K40 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.reportingRecurringPackProduction | FPA_03 Scope L3 / F41 / G41 / I41 / J41 / K41 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.reportingDashboardRefresh | FPA_03 Scope L3 / F42 / G42 / I42 / J42 / K42 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.reportingAdhocAnalysis | FPA_03 Scope L3 / F43 / G43 / I43 / J43 / K43 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.reportingExecBoardPackSupport | FPA_03 Scope L3 / F44 / G44 / I44 / J44 / K44 | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "Y", "disposition": "Transfer", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.reportingDataReconciliation | FPA_03 Scope L3 / F45 / G45 / I45 / J45 / K45 | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | {"status": "Y", "partialPct": "1", "retainedToo": "N", "disposition": "Automate", "locationIntent": "Follow model"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.scenarioBuilds | FPA_03 Scope L3 / F46 / G46 / I46 / J46 / K46 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.scenarioSensitivityRuns | FPA_03 Scope L3 / F47 / G47 / I47 / J47 / K47 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.scenarioRiskAdjustedViews | FPA_03 Scope L3 / F48 / G48 / I48 / J48 / K48 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.profitabilityCustomerProfitability | FPA_03 Scope L3 / F49 / G49 / I49 / J49 / K49 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.profitabilityPricingAnalytics | FPA_03 Scope L3 / F50 / G50 / I50 / J50 / K50 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.profitabilityBusinessCaseModelling | FPA_03 Scope L3 / F51 / G51 / I51 / J51 / K51 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.governancePlanningCalendarGovernance | FPA_03 Scope L3 / F52 / G52 / I52 / J52 / K52 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.governanceEpmAdminMasterData | FPA_03 Scope L3 / F53 / G53 / I53 / J53 / K53 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.governanceAccessHierarchyMaintenance | FPA_03 Scope L3 / F54 / G54 / I54 / J54 / K54 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.governanceBusinessPartneringSupport | FPA_03 Scope L3 / F55 / G55 / I55 / J55 / K55 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.governanceKnowledgeManagementSops | FPA_03 Scope L3 / F56 / G56 / I56 / J56 / K56 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |
| FP&A Scope L3 | fpaWorkspace.scopeL3.governanceContinuousImprovement | FPA_03 Scope L3 / F57 / G57 / I57 / J57 / K57 | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | {"status": "N", "partialPct": "1", "retainedToo": "Y", "disposition": "Retain", "locationIntent": "KDP retained"} | Imported from workbook activity row. |

