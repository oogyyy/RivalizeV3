// Type declarations for the procedural de_mirage blockout (mirage.js).
import * as THREE from 'three'

export const PLAYER_HEIGHT: number
export const EYE_HEIGHT: number

export interface MirageZone {
  name: string
  x0: number; x1: number; y0: number; y1: number
  z: number; h: number
  kind: 't' | 'ct' | 'a' | 'b' | 'n'
}

export const MIRAGE_ZONES: MirageZone[]
export const MIRAGE_LANDMARKS: [string, number, number, number, number, number, number][]

export function worldToThree(x: number, y: number, z?: number): THREE.Vector3
export function createMirageScene(opts?: { spawns?: boolean; bombSites?: boolean }): THREE.Group
export function getSpawnPosition(side: 'T' | 'CT' | string): THREE.Vector3
export function getBombSitePosition(site: 'A' | 'B' | string): THREE.Vector3
export function addZoneLabels(opts?: { scale?: number; color?: string }): THREE.Group
