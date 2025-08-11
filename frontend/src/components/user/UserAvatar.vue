<template>
    <q-avatar :size="size" :color="color" :text-color="textColor">
        {{ initial }}
        <q-badge
            v-if="isOnline"
            color="green"
            align="bottom"
            rounded
            floating
            class="q-badge--online"
        />
    </q-avatar>
</template>

<script>
export default {
    name: 'UserAvatar',
    props: {
        name: {
            type: String,
            default: ''
        },
        isOnline: {
            type: Boolean,
            default: false
        },
        size: {
            type: String,
            default: '40px'
        },
        color: {
            type: String,
            default: 'primary'
        },
        textColor: {
            type: String,
            default: 'white'
        },
    },
    computed: {
        initial() {
            return this.name?.trim()?.charAt(0)?.toUpperCase() || '?'
        }
    }
}
</script>
