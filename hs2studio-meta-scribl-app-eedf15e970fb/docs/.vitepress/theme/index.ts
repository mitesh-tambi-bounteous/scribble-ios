// Custom VitePress theme: the stock DefaultTheme plus a small typography and
// layout stylesheet. We only extend the default; no components are overridden.
// The site config wraps everything in withMermaid(), which is a config wrapper,
// not a theme, so this custom theme coexists with it without conflict.
import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default DefaultTheme
