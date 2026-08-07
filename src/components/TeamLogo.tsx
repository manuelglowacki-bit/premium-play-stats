import React from "react";

type TeamLogoProps = {
  name: string;
  logoUrl?: string | null;
  size?: number;
};

export default function TeamLogo({
  name,
  logoUrl,
  size = 40,
}: TeamLogoProps) {

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full bg-slate-800 border border-slate-700"
      style={{
        width: size,
        height: size,
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-xs font-bold text-white">
          {name.substring(0,2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
