type Props = { children: React.ReactNode };

/** Webmail uses a full-height client; reduce extra vertical padding from domain layout. */
export default function MailLayout({ children }: Props) {
  return <div className="-mt-2">{children}</div>;
}
