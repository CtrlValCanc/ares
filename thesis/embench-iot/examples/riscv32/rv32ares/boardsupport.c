/* Copyright (C) 2012 Embecosm Limited and University of Bristol

   Contributor: Daniel Torres <dtorres@hmc.edu>

   This file is part of Embench and was formerly part of the Bristol/Embecosm
   Embedded Benchmark Suite.

   SPDX-License-Identifier: GPL-3.0-or-later */

#include <stdint.h>
#include <stdlib.h>
#include <support.h>

void start_trigger() {
  asm volatile("li a7, 95      \n"
               "ecall          \n"
               :
               :
               : "a7", "a0");
}
void stop_trigger() {
  asm volatile("li a7, 96      \n"
               "ecall          \n"
               :
               :
               : "a7", "a0");
}

void initialise_board() {}

// taken from musl libc

#include <limits.h>
#include <stdint.h>
#include <string.h>

#define ALIGN (sizeof(size_t))
#define ONES ((size_t)-1 / UCHAR_MAX)
#define HIGHS (ONES * (UCHAR_MAX / 2 + 1))
#define HASZERO(x) ((x) - ONES & ~(x) & HIGHS)

size_t strlen(const char *s) {
  const char *a = s;
#ifdef __GNUC__
  typedef size_t __attribute__((__may_alias__)) word;
  const word *w;
  for (; (uintptr_t)s % ALIGN; s++)
    if (!*s)
      return s - a;
  for (w = (const void *)s; !HASZERO(*w); w++)
    ;
  s = (const void *)w;
#endif
  for (; *s; s++)
    ;
  return s - a;
}

char *__strchrnul(const char *s, int c) {
  c = (unsigned char)c;
  if (!c)
    return (char *)s + strlen(s);

#ifdef __GNUC__
  typedef size_t __attribute__((__may_alias__)) word;
  const word *w;
  for (; (uintptr_t)s % ALIGN; s++)
    if (!*s || *(unsigned char *)s == c)
      return (char *)s;
  size_t k = ONES * c;
  for (w = (void *)s; !HASZERO(*w) && !HASZERO(*w ^ k); w++)
    ;
  s = (void *)w;
#endif
  for (; *s && *(unsigned char *)s != c; s++)
    ;
  return (char *)s;
}

char *strchr(const char *s, int c) {
  char *r = __strchrnul(s, c);
  return *(unsigned char *)r == (unsigned char)c ? r : 0;
}

int isdigit(int c) { return (unsigned)c - '0' < 10; }

int isxdigit(int c) { return isdigit(c) || ((unsigned)c | 32) - 'a' < 6; }

int isupper(int c) { return (unsigned)c - 'A' < 26; }

int tolower(int c) {
  if (isupper(c))
    return c | 32;
  return c;
}

void *memset(void *s, int c, size_t n) {
  unsigned char *p = s;
  while (n--)
    *p++ = (unsigned char)c;
  return s;
}

void *memcpy(void *dest, const void *src, size_t n) {
  unsigned char *d = dest;
  const unsigned char *s = src;
  while (n--)
    *d++ = *s++;
  return dest;
}

void *memmove(void *dest, const void *src, size_t n) {
  unsigned char *d = dest;
  const unsigned char *s = src;
  if (d < s) {
    while (n--)
      *d++ = *s++;
  } else {
    d += n;
    s += n;
    while (n--)
      *--d = *--s;
  }
  return dest;
}

int memcmp(const void *s1, const void *s2, size_t n) {
  const unsigned char *p1 = s1, *p2 = s2;
  while (n--) {
    if (*p1 != *p2)
      return *p1 - *p2;
    p1++;
    p2++;
  }
  return 0;
}

int main();

static inline void __attribute__((noreturn)) sys_exit(int status) {
  asm volatile("li a7, 93      \n" 
               "mv a0, %[code] \n"
               "ecall          \n" 
               :
               : [code] "r"(status)
               : "a7", "a0");
  while (1)
    ;
}

void _start() {
  int retval = main();
  sys_exit(retval);
}
