import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../layout/AppLayout'
import { ExecutiveOverviewPage } from '../features/overview/ExecutiveOverviewPage'
import { ForecastPage } from '../features/forecast/ForecastPage'
import { ScenarioPage } from '../features/scenario/ScenarioPage'
import { HierarchicalIntelligencePage } from '../features/hierarchy/HierarchicalIntelligencePage'
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
      { path: 'hierarchy', element: <HierarchicalIntelligencePage /> },
    ],
  },
])
