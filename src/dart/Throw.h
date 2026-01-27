#ifndef Throw_h
#define Throw_h

#include <Arduino.h>


class Throw
{
    private:
    protected:
        uint8_t value;
        uint8_t field;
        String ring;
        double angle = 0.0;  // Polar coordinate: angle in radians
        double radius = 0.0; // Polar coordinate: radius (0.0 to 1.0+)

    public:
        Throw()
        {
            //
        }

        uint8_t getPoints() const
        {
            return this->value * this->field;
        }

        uint8_t getValue() const
        {
            return this->value;
        }

        uint8_t getField() const
        {
            return this->field;
        }

        String getRing() const
        {
            return this->ring;
        }

        void setValue(uint8_t value)
        {
            this->value = value;
        }

        void setField(uint8_t field)
        {
            this->field = field;
        }

        void setRing(String ring)
        {
            this->ring = ring;
        }

        double getAngle() const
        {
            return this->angle;
        }

        void setAngle(double angle)
        {
            this->angle = angle;
        }

        double getRadius() const
        {
            return this->radius;
        }

        void setRadius(double radius)
        {
            this->radius = radius;
        }

        String toString() const
        {
            String result = "";
            if (field == 3) {
                result = "T" + String(value);
            } else if (field == 2) {
                result = "D" + String(value);
            } else {
                result = String(value);
            }
            return result;
        }
};

#endif
