<template>
  <q-page class="flex flex-center">
      <q-btn
          @click="handleLogout"
          label="logout"
      />
    <img
      alt="Quasar logo"
      src="~assets/quasar-logo-vertical.svg"
      style="width: 200px; height: 200px"
    >
  </q-page>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'IndexPage',
    data() {
    },
    methods: {
        async handleLogout () {
            await this.$store.dispatch('auth/logout')
            this.$router.push('/login')
        }
    }
});
</script>
