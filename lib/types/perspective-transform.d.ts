declare module 'perspective-transform' {
  interface PerspectiveTransform {
    /**
     * Transform a point from source to destination coordinates
     * @param x - X coordinate
     * @param y - Y coordinate
     * @returns Transformed [x, y] coordinates
     */
    transform(x: number, y: number): [number, number];
    
    /**
     * Get the coefficients of the transform matrix
     */
    coeffs: number[];
    
    /**
     * Get the coefficients for the inverse transform
     */
    coeffsInv: number[];
  }

  /**
   * Create a perspective transform from source points to destination points
   * @param srcPts - Source points as [x1,y1, x2,y2, x3,y3, x4,y4]
   * @param dstPts - Destination points as [x1,y1, x2,y2, x3,y3, x4,y4]
   * @returns A PerspectiveTransform object with transform methods
   */
  function PerspT(
    srcPts: [number, number, number, number, number, number, number, number],
    dstPts: [number, number, number, number, number, number, number, number]
  ): PerspectiveTransform;

  export = PerspT;
}
