//! Stub getrandom for Solana BPF/SBF builds.
#![no_std]
#![cfg_attr(not(test), feature(error_in_core))]

pub use error::Error;

mod error {
    use core::fmt;
    use core::num::NonZeroU32;

    #[derive(Copy, Clone, Eq, PartialEq, Debug)]
    pub struct Error(NonZeroU32);

    impl Error {
        pub const UNSUPPORTED: Error = Error(unsafe { NonZeroU32::new_unchecked(u32::MAX) });
        pub const INTERNAL_START: u32 = 1 << 31;
        pub const CUSTOM_START: u32 = (1 << 31) + 64;

        #[inline]
        pub fn raw_os_error(self) -> Option<i32> {
            if self.0.get() < Self::INTERNAL_START {
                Some(self.0.get() as i32)
            } else {
                None
            }
        }

        #[inline]
        pub fn code(self) -> NonZeroU32 {
            self.0
        }
    }

    impl From<NonZeroU32> for Error {
        fn from(code: NonZeroU32) -> Self {
            Error(code)
        }
    }

    impl fmt::Display for Error {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "getrandom: not supported on BPF target")
        }
    }

    impl core::error::Error for Error {}
}

pub fn getrandom(dest: &mut [u8]) -> Result<(), Error> {
    for byte in dest.iter_mut() {
        *byte = 0;
    }
    Ok(())
}

#[macro_export]
macro_rules! register_custom_getrandom {
    ($func:path) => {};
}
