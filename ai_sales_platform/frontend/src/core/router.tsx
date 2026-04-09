import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../layout/AppLayout'
import { ExecutiveOverviewPage } from '../features/overview/ExecutiveOverviewPage'
import { ForecastPage } from '../features/forecast/ForecastPage'
import { ScenarioPage } from '../features/scenario/ScenarioPage'
import { RiskStabilityPage } from '../features/risk/RiskStabilityPage'
import { ExplainabilityPage } from '../features/insights/ExplainabilityPage'
import { FeatureIntelligencePage } from '../features/featureIntel/FeatureIntelligencePage'
import { HierarchicalIntelligencePage } from '../features/hierarchy/HierarchicalIntelligencePage'
import { SeasonalTrendLabPage } from '../features/seasonal/SeasonalTrendLabPage'
import { GovernancePage } from '../features/governance/GovernancePage'
import { DataEngineeringConsolePage } from '../features/dataEng/DataEngineeringConsolePage'
import { AIAssistantPage } from '../features/assistant/AIAssistantPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <ExecutiveOverviewPage /> },
      { path: 'forecast', element: <ForecastPage /> },
      { path: 'scenario', element: <ScenarioPage /> },
      { path: 'risk', element: <RiskStabilityPage /> },
      { path: 'explainability', element: <ExplainabilityPage /> },
      { path: 'feature-intelligence', element: <FeatureIntelligencePage /> },
      { path: 'hierarchy', element: <HierarchicalIntelligencePage /> },
      { path: 'seasonal-trend', element: <SeasonalTrendLabPage /> },
      { path: 'governance', element: <GovernancePage /> },
      { path: 'data-engineering', element: <DataEngineeringConsolePage /> },
      { path: 'assistant', element: <AIAssistantPage /> },
    ],
  },
])
