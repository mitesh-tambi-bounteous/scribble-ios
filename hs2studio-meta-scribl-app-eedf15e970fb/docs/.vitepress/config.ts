import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import {
  buildContextSidebar,
  buildKnowledgeSidebar,
  buildReviewsSidebar,
  buildStoriesSidebar,
  buildWorkshopsSidebar,
  latestWorkshopLink
} from './sidebar.mts'

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

// Workshops surface only when at least one workshop retro has been synced, so
// the nav item and sidebar section never point at nothing.
const workshops = buildWorkshopsSidebar()
const workshopLink = latestWorkshopLink()

// The expo-rebuild epics page surfaces only once its tracking source has been
// synced, so the sidebar never links a page that does not exist yet.
const hasExpoEpics = existsSync(join(DOCS_DIR, 'expo-rebuild-epics.md'))

// Production-planning pages surface only once their sources have been synced,
// same guard pattern as the epics page.
const hasSprintBacklog = existsSync(join(DOCS_DIR, 'production-sprint-backlog.md'))
const hasBackendPlan = existsSync(join(DOCS_DIR, 'production-backend-plan.md'))
const hasScaleTrack = existsSync(join(DOCS_DIR, 'future-scale-track.md'))
const hasJiraBoard = existsSync(join(DOCS_DIR, 'jira-board.md'))

// Doc site for the scribl project brain. Pages under docs/ are rendered
// from s2d/ and tracking/ by scripts/docs-sync.mjs; do not hand-edit generated
// pages.
export default withMermaid({
  title: 'scribl',
  description: 'Generated project brain',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,

  markdown: {
    lineNumbers: true
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'The Story', link: '/story' },
      { text: 'Full-App Spec', link: '/scribl-full-app-spec' },
      { text: 'Roadmap', link: '/roadmap' },
      { text: 'Board', link: '/board' },
      { text: 'Stories', link: '/stories/' },
      ...(workshopLink ? [{ text: 'Workshops', link: workshopLink }] : []),
      { text: 'Knowledge', link: '/knowledge/' }
    ],

    sidebar: [
      {
        text: 'Start Here',
        collapsed: false,
        items: [
          { text: 'Home', link: '/' },
          { text: 'Project Overview', link: '/overview' },
          { text: 'The Story', link: '/story' },
          { text: 'Full-App Spec', link: '/scribl-full-app-spec' }
        ]
      },
      {
        text: 'Discovery & Design',
        collapsed: false,
        items: [
          { text: 'Input Artifacts', link: '/input-artifacts' },
          { text: 'Project Information Index', link: '/context/' },
          ...buildContextSidebar()
        ]
      },
      {
        text: 'Research',
        collapsed: true,
        items: [
          { text: 'Knowledge Index', link: '/knowledge/' },
          ...buildKnowledgeSidebar()
        ]
      },
      ...(workshops.length > 0
        ? [
            {
              text: 'Workshops',
              collapsed: false,
              items: workshops
            }
          ]
        : []),
      {
        text: 'Build & Delivery',
        collapsed: false,
        items: [
          { text: 'Status', link: '/status' },
          { text: 'Handbook Home', link: '/handbook/' },
          { text: 'Definition of Ready', link: '/handbook/definition-of-ready' },
          { text: 'Definition of Done', link: '/handbook/definition-of-done' },
          { text: 'Team Process', link: '/handbook/team-process' },
          { text: 'Ceremonies', link: '/handbook/ceremonies' },
          { text: 'Roles and Responsibilities', link: '/handbook/roles-and-raci' },
          { text: 'Estimation and Forecasting', link: '/handbook/estimation' },
          { text: 'Backlog and Workflow', link: '/handbook/backlog-and-workflow' },
          { text: 'Story and AC Templates', link: '/handbook/story-and-ac-templates' },
          { text: 'Team Chartering', link: '/handbook/team-chartering' },
          { text: 'Glossary', link: '/handbook/glossary' },
          { text: 'Release Management', link: '/handbook/release-management' },
          { text: 'Android Distribution', link: '/android-distribution' },
          { text: 'iOS Distribution', link: '/ios-distribution' },
          { text: 'Board', link: '/board' },
          { text: 'Roadmap', link: '/roadmap' }
        ]
      },
      {
        text: 'Stories',
        collapsed: true,
        items: [
          { text: 'All Stories', link: '/stories/' },
          ...buildStoriesSidebar()
        ]
      },
      {
        text: 'Toward Production',
        collapsed: false,
        items: [
          ...(hasSprintBacklog ? [{ text: 'Production Sprint Backlog', link: '/production-sprint-backlog' }] : []),
          ...(hasBackendPlan ? [{ text: 'Production Backend Plan', link: '/production-backend-plan' }] : []),
          ...(hasScaleTrack ? [{ text: 'Future Scale Track', link: '/future-scale-track' }] : []),
          ...(hasJiraBoard ? [{ text: 'Jira Board (CMPSR)', link: '/jira-board' }] : []),
          { text: 'Production Starter Backlog', link: '/production-backlog' },
          ...(hasExpoEpics ? [{ text: 'Expo Rebuild Epics', link: '/expo-rebuild-epics' }] : [])
        ]
      },
      {
        text: 'Reviews',
        collapsed: true,
        items: [
          { text: 'Reviews Index', link: '/reviews/' },
          ...buildReviewsSidebar()
        ]
      }
    ],

    footer: {
      message: 'Generated project brain',
      copyright: 'Internal use only'
    }
  }
})
