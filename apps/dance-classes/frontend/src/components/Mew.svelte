<script lang="ts">
  interface Props { class?: string; }
  let { class: cls = 'h-16 w-16' }: Props = $props();
</script>

<span class="mimi-mew-spin inline-block">
  <img
    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png"
    alt="Mew"
    loading="lazy"
    class="select-none object-contain {cls}"
    draggable="false"
  />
</span>
