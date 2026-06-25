#include "doomkeys.h"

#include "doomgeneric.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/time.h>

void DG_Init()
{
}

#include <stdint.h>

// Standard BMP Header structures
#pragma pack(push, 1)
typedef struct {
    uint16_t type;
    uint32_t size;
    uint16_t reserved1;
    uint16_t reserved2;
    uint32_t offset;
} BMPHeader;

typedef struct {
    uint32_t size;
    int32_t  width;
    int32_t  height;
    uint16_t planes;
    uint16_t bit_count;
    uint32_t compression;
    uint32_t size_image;
    int32_t  x_pels_per_meter;
    int32_t  y_pels_per_meter;
    uint32_t clr_used;
    uint32_t clr_important;
} BMPInfoHeader;
#pragma pack(pop)


static inline int sys_open(const char *filename, int flags, int mode) {
    register long a0 asm("a0") = -100; // AT_FDCWD
    register const char* a1 asm("a1") = filename;
    register int a2 asm("a2") = flags;
    register int a3 asm("a3") = mode;
    register int a7 asm("a7") = 56;    // openat
    register int res asm("a0");

    asm volatile(
        "ecall\n"
        : "=r"(res)
        : "r"(a0), "r"(a1), "r"(a2), "r"(a3), "r"(a7)
        : "memory"
    );
    return res;
}

static inline long sys_write(unsigned int fd, const char *buf, unsigned long count) {
    register unsigned int a0 asm("a0") = fd;
    register const char* a1 asm("a1") = buf;
    register unsigned long a2 asm("a2") = count;
    register int a7 asm("a7") = 64;    // write
    register long res asm("a0");

    asm volatile(
        "ecall\n"
        : "=r"(res)
        : "r"(a0), "r"(a1), "r"(a2), "r"(a7)
        : "memory"
    );
    return res;
}

static inline int sys_close(unsigned int fd) {
    register unsigned int a0 asm("a0") = fd;
    register int a7 asm("a7") = 57;    // close
    register int res asm("a0");

    asm volatile(
        "ecall\n"
        : "=r"(res)
        : "r"(a0), "r"(a7)
        : "memory"
    );
    return res;
}




static inline int sys_display(void* fb) {
    register int a7 asm("a7") = 9999;    // openat
    register void* a0 asm("a0") = fb;
    register int res asm("a0");

    asm volatile(
        "ecall\n"
        : "=r"(res)
        : "r"(a0), "r"(a7)
        : "memory"
    );
    return res;
}

void DG_DrawFrame() {
    sys_display(DG_ScreenBuffer);
    return;

    static int frame_count = 0;
    char filename[32];
    
    // Using a simple manual sprintf-like logic if standard libs are unavailable
    // For simplicity, we assume filename is "doomX.bmp"
    // sprintf(filename, "doom%d.bmp", frame_count++); 

    // O_WRONLY | O_CREAT | O_TRUNC is usually 0x241 on RISC-V/Linux
    char screen[64];
    snprintf(screen, 64, "/tmp/screenshot%d.bmp", frame_count++);
    int fd = sys_open(screen, 0x241, 0644);
    if (fd < 0) return;

    uint32_t width = DOOMGENERIC_RESX;
    uint32_t height = DOOMGENERIC_RESY;
    uint32_t row_size = (width * 3 + 3) & ~3;
    uint32_t image_size = row_size * height;

    // Bitmap Header (54 bytes)
    uint8_t header[54] = {
        'B', 'M',             // Signature
        0, 0, 0, 0,           // File size (fill below)
        0, 0, 0, 0,           // Reserved
        54, 0, 0, 0,          // Offset to pixel data
        40, 0, 0, 0,          // Info header size
        0, 0, 0, 0,           // Width (fill below)
        0, 0, 0, 0,           // Height (fill below)
        1, 0, 24, 0,          // Planes (1) and Bits per pixel (24)
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 // Rest zeroed
    };

    // Fill in sizes (Little Endian)
    uint32_t total_size = 54 + image_size;
    *(uint32_t*)(header + 2) = total_size;
    *(int32_t*)(header + 18) = width;
    *(int32_t*)(header + 22) = -((int32_t)height); // Negative for top-down

    sys_write(fd, (const char*)header, 54);

    uint8_t padding[3] = {0, 0, 0};
    int pad_len = row_size - (width * 3);

    for (uint32_t y = 0; y < height; y++) {
        for (uint32_t x = 0; x < width; x++) {
            uint32_t pixel = DG_ScreenBuffer[(height-1-y) * width + x];
            uint8_t bgr[3] = {
                (uint8_t)(pixel & 0xFF),         // Blue
                (uint8_t)((pixel >> 8) & 0xFF),  // Green
                (uint8_t)((pixel >> 16) & 0xFF)  // Red
            };
            sys_write(fd, (const char*)bgr, 3);
        }
        if (pad_len > 0) sys_write(fd, (const char*)padding, pad_len);
    }

    sys_close(fd);
}
static int g_ms = 0;

void DG_SleepMs(uint32_t ms)
{
    g_ms += ms;
}

uint32_t DG_GetTicksMs()
{
    return g_ms;
}

int DG_GetKey(int* pressed, unsigned char* doomKey)
{
    return 0;
}

void DG_SetWindowTitle(const char * title)
{
}

int main(int argc, char **argv)
{
    doomgeneric_Create(argc, argv);

    while(1)
    {
      doomgeneric_Tick(); 
    }

    return 0;
}

