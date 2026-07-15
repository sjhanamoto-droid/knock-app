import Image from "next/image";

/**
 * Knock ワードマークロゴ（/public/knock-logo.png, 元サイズ 621x432）。
 * width を指定すると縦横比を保って表示する。
 */
export function KnockLogoImage({
  width = 150,
  className,
  priority = false,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/knock-logo.png"
      alt="Knock"
      width={width}
      height={Math.round((width * 432) / 621)}
      priority={priority}
      className={className}
    />
  );
}
