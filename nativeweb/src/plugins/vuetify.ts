/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'

// Icons
import { h } from "vue";
import { mdi } from "vuetify/iconsets/mdi";
import SatsIcon from '@/components/SatsIcon.vue'
import type { IconProps } from "vuetify";

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  theme: {
    defaultTheme: 'dark',
  },
  icons: {
      defaultSet: 'mdi',
      sets: {
          mdi,
          custom: {
              component: (props: IconProps) => h(SatsIcon)
          }
      }
  }
})
