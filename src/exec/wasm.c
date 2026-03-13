#ifdef __wasm__
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define MALLOC_ALIGN 8

extern char __heap_base;
size_t g_heap_size = 0;
extern void panic();

void *memset(void *dest, int c, size_t n) {
    uint8_t *pdest = (uint8_t *)dest;

    for (size_t i = 0; i < n; i++) {
        pdest[i] = c;
    }

    return dest;
}

void *malloc(size_t size) {
    if (size == 0) return NULL;
    size_t heap_base = (size_t)&__heap_base;
    size_t curr = heap_base + g_heap_size;
    size_t aligned = (curr + (MALLOC_ALIGN - 1)) & ~(MALLOC_ALIGN - 1);
    size_t end;
    if (__builtin_add_overflow(aligned, size, &end)) return NULL;
    size_t allocated = __builtin_wasm_memory_size(0) << 16;
    if (end > allocated) {
        size_t delta = end - allocated;
        size_t delta_pages = (delta + 65535) >> 16;
        if (__builtin_wasm_memory_grow(0, delta_pages) == -1)
            return NULL;
    }
    g_heap_size = end - heap_base;
    return (void *)aligned;
}

void *calloc(size_t n, size_t size) {
    size_t total;
    if (__builtin_mul_overflow(n, size, &total)) return NULL;
    void *ptr = malloc(total);
    if (ptr) __builtin_memset(ptr, 0, total);
    return ptr;
}


void free(void *ptr) {
    // lol
}

size_t strlen(const char *str) {
    const char *s;
    for (s = str; *s; ++s);
    return s - str;
}

int memcmp(const void *s1, const void *s2, size_t n) {
    const uint8_t *p1 = (const uint8_t *)s1;
    const uint8_t *p2 = (const uint8_t *)s2;
    for (size_t i = 0; i < n; i++) {
        if (p1[i] != p2[i]) {
            return p1[i] < p2[i] ? -1 : 1;
        }
    }
    return 0;
}

void *memcpy(void *dest, const void *src, size_t n) {
    uint8_t *pdest = (uint8_t *)dest;
    const uint8_t *psrc = (const uint8_t *)src;

    for (size_t i = 0; i < n; i++) {
        pdest[i] = psrc[i];
    }

    return dest;
}


#endif